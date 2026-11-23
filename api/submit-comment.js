import { createHmac } from "node:crypto";
export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const { comment, token } = req.body || {};

        if (
            typeof comment !== "string" ||
            !comment.trim() ||
            comment.trim().length > 1000
        ) {
            return res.status(400).json({
                error: "Invalid comment."
            });
        }

        if (!token || typeof token !== "string") {
            return res.status(400).json({
                error: "Missing verification token."
            });
        }

        // Verify with Cloudflare
        const verification = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    secret: process.env.TURNSTILE_SECRET_KEY,
                    response: token
                })
            }
        );

        const result = await verification.json();

        if (!result.success) {
            return res.status(403).json({
                error: "Cloudflare verification failed."
            });
                }
        const ip = req.headers["cf-connecting-ip"];

        if (!ip) {
            return res.status(400).json({
                error: "Could not identify visitor IP."
            });
        }

        // Generate HMAC-SHA256 hash
        const ipHash = createHmac(
            "sha256",
            process.env.IP_HASH_SECRET
        )
        .update(ip.trim())
        .digest("hex");
        // Store visitor IP
        const visitorResponse = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/visitor_ips?on_conflict=ip_hash`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    "Prefer": "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify({
                    ip_hash: ipHash,
                    ip_address: ip.trim(),
                    last_seen: new Date().toISOString()
                })
            }
        );

        if (!visitorResponse.ok) {
            console.error(
                "Visitor storage error:",
                await visitorResponse.text()
            );

            return res.status(500).json({
                error: "Visitor storage failed."
            });
        }

        // Insert into Supabase
        const dbResponse = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/collection`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization":
                        `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                    comment: comment.trim()
                })
            }
        );

        if (!dbResponse.ok) {
            const error = await dbResponse.text();
            console.error("Supabase error:", error);

            return res.status(500).json({
                error: "Database insertion failed."
            });
        }

        return res.status(200).json({
            success: true
        });

    } catch (error) {

        console.error("Server error:", error);

        return res.status(500).json({
            error: "Internal server error."
        });
    }
}
