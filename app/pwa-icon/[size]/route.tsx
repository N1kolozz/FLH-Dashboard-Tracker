import { ImageResponse } from "next/og";
import FlhIconMark from "@/components/FlhIconMark";

const ALLOWED_SIZES = new Set(["192", "512"]);

function renderIcon(size: number) {
  const logoWidth = Math.round(size * 0.72);
  const logoHeight = Math.round(size * 0.75);

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
        <FlhIconMark width={logoWidth} height={logoHeight} />
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { size: string } }
) {
  const size = params.size;

  if (!ALLOWED_SIZES.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  return renderIcon(Number(size));
}
