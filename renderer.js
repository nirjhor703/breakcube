const videoElement = document.getElementById("videoPlayer");
const nextBtn = document.getElementById("nextBtn");
const timerText = document.getElementById("timer");

// Replace with your Pixabay API Key
const API_KEY = "51379127-723f7070c4ef9633bb557a566";

// Categories mapping with multiple query options for variety
const categoryMap = {
    "relax": ["lofi", "nature scenery", "calm", "forest", "waterfall"],
    "fun": ["funny animals", "funny", "cute animals", "pets"],
    "motivation": ["motivation", "motivational speech", "gym workout"],
    "nature": ["nature", "wildlife", "scenery"],
    "sports": ["sports", "football", "basketball", "soccer"],
    "tech": ["technology", "gadgets", "robots"]
};

// Get categories from URL param 'data'
const urlParams = new URLSearchParams(window.location.search);
let data;
try {
    data = JSON.parse(urlParams.get("data"));
} catch {
    data = null;
}
const categories = data && Array.isArray(data.categories) && data.categories.length > 0
    ? data.categories
    : ["relax"]; // default fallback

let sessionStartTime = Date.now();
const sessionDuration = 10 * 60 * 1000; // 10 minutes

// Fetch random video URL from Pixabay with flexible fallback
async function getRandomVideoURL() {
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    const queryArray = categoryMap[selectedCategory] || ["relax"];
    const query = queryArray[Math.floor(Math.random() * queryArray.length)];

    const apiURL = `https://pixabay.com/api/videos/?key=${API_KEY}&q=${encodeURIComponent(query)}&per_page=50`;

    try {
        const response = await fetch(apiURL);
        const json = await response.json();

        if (json.hits && json.hits.length > 0) {
            // Select a random video from results
            const randomVideo = json.hits[Math.floor(Math.random() * json.hits.length)];

            // Prefer large, then medium, then tiny
            if (randomVideo.videos.large) return randomVideo.videos.large.url;
            if (randomVideo.videos.medium) return randomVideo.videos.medium.url;
            if (randomVideo.videos.tiny) return randomVideo.videos.tiny.url;

            console.warn("No usable video formats found, trying another.");
            return null;
        } else {
            console.warn(`No videos found for ${query}. Trying fallback.`);
            return null;
        }
    } catch (err) {
        console.error("Error fetching videos:", err);
        return null;
    }
}

// Play a random video
async function playRandomVideo() {
    let attempts = 0;
    let videoURL = null;

    while (!videoURL && attempts < 5) { // Try up to 5 times with different queries
        videoURL = await getRandomVideoURL();
        attempts++;
    }

    if (videoURL) {
        videoElement.src = videoURL;
        videoElement.play();
        start30sTimer();
    } else {
        alert("No videos found for your selected categories. Please try again later.");
        window.close();
    }
}

// Show Next button for 30 seconds after video starts
let nextTimer;
function start30sTimer() {
    nextBtn.style.display = "inline-block";
    let seconds = 30;
    timerText.innerText = `Next available in: ${seconds}s`;

    clearInterval(nextTimer);
    nextTimer = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
            clearInterval(nextTimer);
            nextBtn.style.display = "inline-block";
            timerText.innerText = "";
        } else {
            timerText.innerText = `Next available in: ${seconds}s`;
        }
    }, 1000);
}

// Next button click - play next random video
nextBtn.addEventListener("click", playRandomVideo);

// When video ends, auto play next if session time allows
videoElement.addEventListener("ended", () => {
    const elapsed = Date.now() - sessionStartTime;
    if (elapsed < sessionDuration) {
        playRandomVideo();
    } else {
        window.close(); // Close app or window after session ends
    }
});

// Close window after total session duration
function startSessionTimer() {
    setTimeout(() => {
        window.close();
    }, sessionDuration);
}

// Start the session: play first video and start session timer
playRandomVideo();
startSessionTimer();
