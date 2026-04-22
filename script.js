const APP_ID = "79f80c0390e14a06adf7d98e3a0056af";
const CHANNEL = localStorage.getItem('id');

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// Global variables so the toggle functions can see them
let localTracks = {
    audioTrack: null,
    videoTrack: null
};

let isMicMuted = false;
let isVideoMuted = false;

async function startCall() {
    // Listen for others BEFORE joining
    client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
            // FIX: Check if a div for this user already exists to prevent jumping
            let remotePlayer = document.getElementById(user.uid);
            
            if (!remotePlayer) {
                remotePlayer = document.createElement("div");
                remotePlayer.id = user.uid;
                remotePlayer.className = "video-player";
                document.getElementById("video-container").append(remotePlayer);
            }
            
            // Play the video inside the existing/newly created div
            user.videoTrack.play(remotePlayer);
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
        }
    });

    client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
            const remotePlayer = document.getElementById(user.uid);
            if (remotePlayer) {
                // Keep the div, but show the placeholder text
                // The black background comes from your CSS .video-player class
                remotePlayer.innerHTML = "<div style='color: #777; font-family: sans-serif;'>Camera Off</div>";
            }
        }
    });

    // Only remove the container when they actually leave the session
    client.on("user-left", (user) => {
        const remotePlayer = document.getElementById(user.uid);
        if (remotePlayer) remotePlayer.remove();
    });

    // 1. Join the channel
    await client.join(APP_ID, CHANNEL, null);

    // 2. Access hardware and save to our global localTracks
    [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    
    // 3. Play and Publish
    localTracks.videoTrack.play("local-player");
    await client.publish([localTracks.audioTrack, localTracks.videoTrack]);
}

// --- TOGGLE FUNCTIONS ---

async function toggleMic() {
    if (!localTracks.audioTrack) return;
    isMicMuted = !isMicMuted;
    await localTracks.audioTrack.setMuted(isMicMuted);
    document.getElementById("mic-btn").innerText = isMicMuted ? "Unmute Mic" : "Mute Mic";
}

async function toggleVideo() {
    if (!localTracks.videoTrack) return;
    isVideoMuted = !isVideoMuted;
    await localTracks.videoTrack.setMuted(isVideoMuted);
    document.getElementById("video-btn").innerText = isVideoMuted ? "Start Video" : "Stop Video";
}

async function leaveCall() {
    for (let trackName in localTracks) {
        let track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = null;
        }
    }

    await client.leave();
    window.location.href = "index.html"; 
}

document.getElementById("mic-btn").onclick = toggleMic;
document.getElementById("video-btn").onclick = toggleVideo;

startCall();

window.onbeforeunload = function() {
    // Pass false if you don't want it to try redirecting while the tab is closing
    leaveCall(); 
};