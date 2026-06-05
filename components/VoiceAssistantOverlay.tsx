"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality, type Session } from "@google/genai";
import { Mic, MicOff, X, Loader2, AudioLines, Minus, Maximize2 } from "lucide-react";
import FixedPortal from "@/components/FixedPortal";
import {
  createVoiceAssistantToken,
  runVoiceAssistantTool,
} from "@/app/actions/voice-assistant";
import {
  buildVoiceAssistantSystemInstruction,
  toFunctionDeclarations,
} from "@/lib/voice-assistant/config";

type Status =
  | "connecting"
  | "listening"
  | "speaking"
  | "muted"
  | "error"
  | "ended";

interface Props {
  /** Fully ends the session and unmounts the overlay. */
  onClose: () => void;
  /** Hides the modal UI but keeps the live session running. */
  onMinimize: () => void;
  /** Brings the modal UI back from the minimized pill. */
  onRestore: () => void;
  /** When true, only the compact pill is shown — session stays alive. */
  minimized: boolean;
}

const OUTPUT_SAMPLE_RATE = 24_000;
const INPUT_SAMPLE_RATE = 16_000;

// Decode base64 → Int16Array (LE) → Float32Array for Web Audio API.
function pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const sampleCount = len / 2;
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return out;
}

// ArrayBuffer (Int16 PCM) → base64 string.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}

export default function VoiceAssistantOverlay({
  onClose,
  onMinimize,
  onRestore,
  minimized,
}: Props) {
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Refs hold everything that survives renders and gets torn down on close.
  const sessionRef = useRef<Session | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const playbackQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const playbackTailTimeRef = useRef(0);
  const mutedRef = useRef(false);
  const closedRef = useRef(false);

  const stopPlayback = useCallback(() => {
    for (const node of playbackQueueRef.current) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        /* already stopped */
      }
    }
    playbackQueueRef.current = [];
    playbackTailTimeRef.current = 0;
  }, []);

  const cleanup = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;

    stopPlayback();

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    try {
      analyserNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    analyserNodeRef.current = null;

    try {
      processorNodeRef.current?.disconnect();
      if (processorNodeRef.current) {
        processorNodeRef.current.onaudioprocess = null;
      }
    } catch {
      /* noop */
    }
    processorNodeRef.current = null;

    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    sourceNodeRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    inputCtxRef.current?.close().catch(() => undefined);
    inputCtxRef.current = null;

    outputCtxRef.current?.close().catch(() => undefined);
    outputCtxRef.current = null;

    try {
      sessionRef.current?.close();
    } catch {
      /* noop */
    }
    sessionRef.current = null;
  }, [stopPlayback]);

  const closeWithError = useCallback(
    (message: string) => {
      setErrorMsg(message);
      setStatus("error");
      cleanup();
    },
    [cleanup]
  );

  const handleClose = useCallback(() => {
    cleanup();
    setStatus("ended");
    onClose();
  }, [cleanup, onClose]);

  // Schedule a PCM chunk for playback on the output AudioContext.
  const enqueueAudioChunk = useCallback((base64: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    // Chrome autoplay policy: even after resume() during user gesture, the
    // context can drop back to "suspended" after async ops. Resume it on
    // every chunk so playback always happens.
    if (ctx.state === "suspended") void ctx.resume();

    const samples = pcm16ToFloat32(base64);
    if (samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, playbackTailTimeRef.current);
    source.start(startAt);
    playbackTailTimeRef.current = startAt + buffer.duration;

    playbackQueueRef.current.push(source);
    source.onended = () => {
      playbackQueueRef.current = playbackQueueRef.current.filter(
        (n) => n !== source
      );
      if (playbackQueueRef.current.length === 0 && !closedRef.current) {
        setStatus((s) => (s === "speaking" ? "listening" : s));
      }
    };

    setStatus((s) => (s === "listening" || s === "connecting" ? "speaking" : s));
  }, []);

  // Dispatch every tool call the model emits, then send the responses back.
  const handleToolCall = useCallback(
    async (
      session: Session,
      functionCalls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>
    ) => {
      const responses = await Promise.all(
        functionCalls.map(async (call) => {
          const result = await runVoiceAssistantTool(
            call.name ?? "",
            (call.args ?? {}) as Record<string, unknown>
          );
          return {
            id: call.id,
            name: call.name,
            response: result.success
              ? { output: result.data }
              : { error: result.error },
          };
        })
      );
      try {
        session.sendToolResponse({ functionResponses: responses });
      } catch (e) {
        console.error("[voice] failed to send tool response", e);
      }
    },
    []
  );

  // Start a Live session and wire all the audio plumbing. Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    // React Strict Mode runs effects twice in dev (mount → cleanup → mount).
    // The first cleanup sets closedRef.current = true, which would poison
    // every subsequent guard check on the second mount. Reset it here so
    // each effect run starts fresh.
    closedRef.current = false;

    (async () => {
      try {
        // 1) Mint ephemeral token (server action, requires auth).
        const tokenResult = await createVoiceAssistantToken();
        if (cancelled) return;
        if (!tokenResult.success) {
          closeWithError(tokenResult.error);
          return;
        }

        // 2) Microphone permission.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        // 3) Output context (24 kHz playback) — must be created after a user
        //    gesture, which the button click satisfies.
        const outCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
        if (outCtx.state === "suspended") await outCtx.resume();
        outputCtxRef.current = outCtx;

        // 4) Input AudioContext at OS-default sampleRate. Chrome has a bug
        // where ScriptProcessorNode.onaudioprocess never fires when
        // AudioContext is created with a custom sampleRate, so we let the OS
        // choose (usually 48000) and downsample to 16 kHz in JS.
        const inCtx = new AudioContext();
        inputCtxRef.current = inCtx;
        if (inCtx.state === "suspended") await inCtx.resume();
        const ratio = inCtx.sampleRate / INPUT_SAMPLE_RATE;

        const sourceNode = inCtx.createMediaStreamSource(stream);
        const bufferSize = 4096;
        const processorNode = inCtx.createScriptProcessor(bufferSize, 1, 1);
        sourceNodeRef.current = sourceNode;
        processorNodeRef.current = processorNode;

        // Analyser is a parallel tap on the mic signal — used purely to drive
        // the orb's visual response when the user is talking. Smoothing avoids
        // jitter; fftSize 256 is plenty for an RMS level.
        const analyser = inCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        analyserNodeRef.current = analyser;
        sourceNode.connect(analyser);

        const timeData = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (closedRef.current) return;
          analyser.getByteTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / timeData.length);
          // Amplify so normal speech maps to ~0.5–0.9; cap at 1.
          const level = mutedRef.current ? 0 : Math.min(1, rms * 5);
          if (orbRef.current) {
            orbRef.current.style.setProperty("--mic-level", level.toFixed(3));
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        // Register the handler BEFORE connecting nodes and BEFORE opening the
        // live session. The session open is a network round trip and the
        // audio graph can stall if no handler is attached when audio flows.
        processorNode.onaudioprocess = (event) => {
          if (mutedRef.current) return;
          if (!sessionRef.current || closedRef.current) return;

          const channel = event.inputBuffer.getChannelData(0);
          const outLength = Math.floor(channel.length / ratio);
          const int16 = new Int16Array(outLength);
          for (let i = 0; i < outLength; i++) {
            const sample = channel[Math.floor(i * ratio)] || 0;
            const clamped = Math.max(-1, Math.min(1, sample));
            int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
          }

          const base64 = arrayBufferToBase64(int16.buffer);
          try {
            sessionRef.current.sendRealtimeInput({
              audio: {
                data: base64,
                mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
              },
            });
          } catch (err) {
            console.error("[voice] sendRealtimeInput failed:", err);
            setErrorMsg(
              err instanceof Error ? err.message : String(err)
            );
          }
        };

        // Route through a muted gain to destination — required for
        // ScriptProcessorNode to fire on Chrome.
        const silentGain = inCtx.createGain();
        silentGain.gain.value = 0;
        sourceNode.connect(processorNode);
        processorNode.connect(silentGain);
        silentGain.connect(inCtx.destination);

        // 5) Open the Live session using the ephemeral token as the API key.
        const ai = new GoogleGenAI({
          apiKey: tokenResult.token,
          apiVersion: tokenResult.apiVersion,
        });

        const session = await ai.live.connect({
          model: tokenResult.model,
          callbacks: {
            onopen: () => {
              if (cancelled) return;
              console.info("[voice] Live session opened");
              setStatus("listening");
            },
            onmessage: (msg) => {
              if (cancelled) return;

              if (msg.serverContent?.interrupted) {
                stopPlayback();
                setStatus("listening");
              }

              const parts = msg.serverContent?.modelTurn?.parts ?? [];
              for (const part of parts) {
                const inline = part.inlineData;
                if (inline?.data && inline.mimeType?.startsWith("audio/pcm")) {
                  enqueueAudioChunk(inline.data);
                }
              }

              const calls = msg.toolCall?.functionCalls;
              if (calls && calls.length > 0) {
                void handleToolCall(session, calls);
              }
            },
            onerror: (event) => {
              console.error("[voice] Live session error", event);
              closeWithError(
                "შეცდომა Gemini Live-თან კავშირისას. სცადეთ ხელახლა."
              );
            },
            onclose: () => {
              /* session closed */
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: {
              parts: [
                {
                  text: buildVoiceAssistantSystemInstruction(tokenResult.user),
                },
              ],
            },
            tools: [
              {
                functionDeclarations: toFunctionDeclarations(),
              },
            ],
          },
        });
        if (cancelled) {
          session.close();
          return;
        }
        sessionRef.current = session;

        // (Audio handler was registered earlier, before this network call.)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "უცნობი შეცდომა.";
        if (
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
        ) {
          closeWithError(
            "მიკროფონზე წვდომა აკრძალულია. გთხოვთ ნება დართოთ ბრაუზერის პარამეტრებიდან."
          );
        } else {
          closeWithError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC minimizes (non-destructive) — the session keeps running. Only the
  // red "დასრულება" button ends the session entirely.
  useEffect(() => {
    if (minimized) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMinimize();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [minimized, onMinimize]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      setStatus((s) => (next ? "muted" : s === "muted" ? "listening" : s));
      return next;
    });
  };

  const statusLabel = (() => {
    switch (status) {
      case "connecting":
        return "ვუკავშირდები…";
      case "listening":
        return "გისმენთ — ილაპარაკეთ";
      case "speaking":
        return "ახლა ვლაპარაკობ…";
      case "muted":
        return "მიკროფონი გათიშულია";
      case "error":
        return "შეცდომა";
      case "ended":
        return "დასრულდა";
    }
  })();

  // Minimized: hide the modal but keep the session alive. A compact pill
  // lets the user reopen the assistant or end it entirely.
  if (minimized) {
    return (
      <FixedPortal>
        {/* Mobile: sits in the header's right slot, replacing the launch logo.
            Desktop: floats at the bottom-right (unchanged). */}
        <div className="fixed z-[100] flex items-center gap-2 rounded-full border border-white/15 bg-gradient-to-br from-slate-900 via-purple-950/90 to-indigo-950 shadow-2xl max-md:right-3 max-md:top-3 max-md:gap-2.5 max-md:py-1 max-md:pl-1.5 max-md:pr-1.5 md:bottom-4 md:right-4 md:py-2 md:pl-3 md:pr-2">
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ${
              status === "speaking" || status === "listening"
                ? "animate-pulse"
                : ""
            }`}
          >
            {status === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : status === "muted" ? (
              <MicOff className="h-4 w-4 text-white/70" />
            ) : (
              <AudioLines className="h-4 w-4 text-white" />
            )}
          </span>
          <span className="max-w-[10rem] truncate text-xs font-medium text-white/80 max-md:hidden">
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="ასისტენტის გახსნა"
            title="ასისტენტის გახსნა"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/90 text-white transition-colors hover:bg-rose-600 max-md:ml-3.5"
            aria-label="დასრულება"
            title="დასრულება"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </FixedPortal>
    );
  }

  return (
    <FixedPortal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      onClick={onMinimize}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-purple-950/90 to-indigo-950 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onMinimize}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="ჩაკეცვა"
          title="ჩაკეცვა — საუბარი გრძელდება"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
            FLHUB · ხმოვანი ასისტენტი
          </p>

          {/* Orb — `--mic-level` is updated each animation frame by the
              analyser tap (0 = silence, 1 = loud). When the user is talking
              the rings expand outward; when the AI speaks, the existing
              status-driven animation takes over. */}
          <div
            ref={orbRef}
            className="voice-orb relative flex h-44 w-44 items-center justify-center"
            style={{ ["--mic-level" as string]: "0" }}
            data-status={status}
          >
            <span
              aria-hidden="true"
              className={`voice-orb-halo absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 blur-2xl transition-opacity duration-500 ${
                status === "speaking"
                  ? "animate-pulse opacity-90"
                  : status === "listening"
                    ? "opacity-60"
                    : status === "muted" || status === "error"
                      ? "opacity-30"
                      : "opacity-50"
              }`}
            />
            <span
              aria-hidden="true"
              className="voice-orb-ring absolute inset-4 rounded-full bg-gradient-to-br from-purple-400/40 to-indigo-400/20 ring-1 ring-white/20"
            />
            <span
              aria-hidden="true"
              className="voice-orb-ring-outer absolute inset-2 rounded-full ring-1 ring-white/15"
            />
            <div className="voice-orb-core relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur-sm">
              {status === "connecting" ? (
                <Loader2 className="h-10 w-10 animate-spin text-white" />
              ) : status === "muted" ? (
                <MicOff className="h-10 w-10 text-white/70" />
              ) : (
                <AudioLines
                  className={`h-10 w-10 text-white ${
                    status === "speaking" ? "animate-pulse" : ""
                  }`}
                />
              )}
            </div>
          </div>
          <style jsx>{`
            .voice-orb-ring {
              transform: scale(calc(1 + var(--mic-level) * 0.25));
              transition: transform 80ms linear;
            }
            .voice-orb-ring-outer {
              transform: scale(calc(1 + var(--mic-level) * 0.45));
              opacity: calc(0.15 + var(--mic-level) * 0.55);
              transition: transform 100ms linear, opacity 100ms linear;
            }
            .voice-orb-core {
              transform: scale(calc(1 + var(--mic-level) * 0.08));
              transition: transform 80ms linear;
            }
            .voice-orb[data-status="speaking"] .voice-orb-ring,
            .voice-orb[data-status="speaking"] .voice-orb-ring-outer,
            .voice-orb[data-status="speaking"] .voice-orb-core {
              transform: scale(1.1);
            }
            .voice-orb[data-status="muted"] .voice-orb-ring-outer,
            .voice-orb[data-status="connecting"] .voice-orb-ring-outer,
            .voice-orb[data-status="error"] .voice-orb-ring-outer {
              opacity: 0;
            }
          `}</style>

          <div className="text-center">
            <p className="text-lg font-semibold text-white">{statusLabel}</p>
            {status === "error" && errorMsg && (
              <p className="mt-2 max-w-xs text-sm text-rose-200/90">{errorMsg}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              disabled={status === "connecting" || status === "error"}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                muted
                  ? "bg-rose-500/80 text-white hover:bg-rose-500"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              aria-label={muted ? "მიკროფონის ჩართვა" : "მიკროფონის გათიშვა"}
              title={muted ? "მიკროფონის ჩართვა" : "მიკროფონის გათიშვა"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-rose-500 px-6 text-sm font-medium text-white shadow-lg shadow-rose-500/30 transition-colors hover:bg-rose-600"
            >
              <X className="h-4 w-4" /> დასრულება
            </button>
          </div>
        </div>
      </div>
    </div>
    </FixedPortal>
  );
}
