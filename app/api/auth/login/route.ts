import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    const masterEmail = (
      process.env.MASTER_EMAIL ||
      process.env.NEXT_PUBLIC_MASTER_EMAIL ||
      ""
    ).trim().toLowerCase();
    const masterPass = (process.env.MASTER_PASS || "").trim();

    if (masterPass && masterEmail && cleanEmail === masterEmail && cleanPass === masterPass) {
      return NextResponse.json({
        isMaster: true,
        success: true,
        email: masterEmail,
        name: "مدير كوبي كات",
      });
    }

    return NextResponse.json({ isMaster: false });
  } catch (error) {
    console.error("Master auth check failed:", error);
    return NextResponse.json(
      { isMaster: false, error: "فشل التحقق من البيانات" },
      { status: 500 }
    );
  }
}
