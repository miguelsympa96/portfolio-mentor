import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f6f1",
          padding: "100px",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#67A67D", marginBottom: 40 }}>
          raisemyportfolio.com
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 62,
            fontFamily: "serif",
            color: "#1c2a22",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 950,
          }}
        >
          Don&apos;t let your portfolio cost you the interview
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 28,
            color: "#4d5b53",
            textAlign: "center",
          }}
        >
          The same 10 second filter a senior recruiter would apply
        </div>
      </div>
    ),
    { ...size }
  );
}
