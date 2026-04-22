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
          background: "#ffffff",
        }}
      >
        <FlhIconMark width={128} height={134} />
      </div>
    ),
    {
      width: 180,
      height: 180,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}
