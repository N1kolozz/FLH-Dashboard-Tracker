import { ImageResponse } from "next/og";
import FlhIconMark from "@/components/FlhIconMark";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <FlhIconMark width={64} height={66} />
      </div>
    ),
    {
      width: 64,
      height: 64,
    }
  );
}
