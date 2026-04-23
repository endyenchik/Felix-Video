const APP_ID = "2bb254f4f40940dc945729ec63a55209";
const CHANNEL = localStorage.getItem('id');

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = {
    audioTrack: null,
    videoTrack: null
};

let isMicMuted = false;
let isVideoMuted = false;

async function startCall() {
    // --- REMOTE USER LISTENERS ---
    client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
            let remotePlayer = document.getElementById(user.uid);
            
            if (!remotePlayer) {
                remotePlayer = document.createElement("div");
                remotePlayer.id = user.uid;
                remotePlayer.className = "video-player";
                document.getElementById("video-container").append(remotePlayer);
            }
            
            // FIX: Completely empty the div before playing the video.
            // This removes any "Camera Off" text so the video doesn't overlap it.
            remotePlayer.innerHTML = ""; 
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
                // Clear the video and replace it with the placeholder
                remotePlayer.innerHTML = "<div style='color: #777; font-family: sans-serif;'>Camera Off</div>";
            }
        }
    });

    client.on("user-left", (user) => {
        const remotePlayer = document.getElementById(user.uid);
        if (remotePlayer) remotePlayer.remove();
    });

    // --- JOIN SESSION ---
    await client.join(APP_ID, CHANNEL, null);

    [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    
    localTracks.videoTrack.play("local-player");
    await client.publish([localTracks.audioTrack, localTracks.videoTrack]);
}

// --- CONTROLS ---
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

document.getElementById("mic-btn").onclick = toggleMic;
document.getElementById("video-btn").onclick = toggleVideo;

startCall();
