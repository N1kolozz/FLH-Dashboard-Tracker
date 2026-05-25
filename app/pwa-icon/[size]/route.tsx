import { ImageResponse } from "next/og";
import FlhIconMark from "@/components/FlhIconMark";

export const runtime = "edge";

const ALLOWED_SIZES = new Set(["192", "512"]);

function renderIcon(size: number, isTransparent: boolean) {
  const logoWidth = Math.round(size * 0.80);
  const logoHeight = Math.round(size * 0.83);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isTransparent
            ? "transparent"
            : "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)",
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

export async function GET(request: Request, props: { params: Promise<{ size: string }> }) {
  const params = await props.params;
  const size = params.size;
  const { searchParams } = new URL(request.url);
  const isTransparent = searchParams.get("bg") === "transparent";

  if (!ALLOWED_SIZES.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  return renderIcon(Number(size), isTransparent);
}
