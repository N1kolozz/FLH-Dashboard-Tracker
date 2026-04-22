import { ImageResponse } from "next/og";
import FlhIconMark from "@/components/FlhIconMark";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)",
        }}
      >
        <FlhIconMark width={144} height={150} />
      </div>
    ),
    size
  );
}
