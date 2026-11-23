const db = window.supabase.createClient(
    "https://wftijkufxazywogxhybz.supabase.co",
    "sb_publishable_Z5J63Ru6aAIFW9NdXnUA8g_fnaKHO6B"
);


const submitBtn = document.getElementById("submit-btn");
const input = document.getElementById("comment");
const feed = document.getElementById("comments-feed");

let turnstileToken = "";

// Cloudflare callbacks
window.onTurnstileSuccess = function(token) {
    turnstileToken = token;
};

window.onTurnstileExpired = function() {
    turnstileToken = "";
};

// Retrieve comments (unchanged)
async function getComments() {

    const { data, error } = await db
        .from("collection")
        .select("id, comment, comment_date")
        .order("comment_date", { ascending: true });

    if (error) {
        console.error("Retrieval error:", error);
        return;
    }

    feed.replaceChildren();

    data.forEach(item => {

        const commentDiv = document.createElement("div");
        commentDiv.className = "comment";

        const message = document.createElement("p");
        message.textContent = item.comment;

        const date = document.createElement("small");
        date.textContent = new Date(item.comment_date)
            .toLocaleString();

        commentDiv.append(message, date);
        feed.appendChild(commentDiv);
    });

    feed.scrollTop = feed.scrollHeight;
}

feed.scrollTop = feed.scrollHeight;

// Submit comment
async function postComment() {

    const message = input.value.trim();

    if (!message) return;

    if (!turnstileToken) {
        alert("Please complete Cloudflare verification.");
        return;
    }

    submitBtn.disabled = true;

    try {

        const response = await fetch("/api/submit-comment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                comment: message,
                token: turnstileToken
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Submission failed.");
        }

        input.value = "";
        await getComments();

    } catch (error) {

        console.error("Submission error:", error);
        alert(error.message || "Failed to submit comment.");

    } finally {

        turnstileToken = "";

        if (window.turnstile) {
            window.turnstile.reset();
        }

        submitBtn.disabled = false;
    }
}

// Button event
submitBtn.addEventListener("click", postComment);

// Load comments
getComments();
setInterval(getComments, 5000);
