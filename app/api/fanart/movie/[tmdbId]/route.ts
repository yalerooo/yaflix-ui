import { NextRequest, NextResponse } from "next/server";

const FANART_API_KEY = "98623ce0cb012c4c726d73f9c740e5e5";
const FANART_BASE_URL = "https://webservice.fanart.tv/v3";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const { tmdbId } = await context.params;

  if (!tmdbId) {
    return NextResponse.json(
      { error: "TMDB ID is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${FANART_BASE_URL}/movies/${tmdbId}?api_key=${FANART_API_KEY}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: response.status === 404 ? "No artwork found" : `Fanart.tv API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      },
    });
  } catch (error) {
    console.error("[Fanart.tv Movie API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch movie artwork" },
      { status: 500 }
    );
  }
}
