const APP_ID = "2bb254f4f40940dc945729ec63a55209";
const CHANNEL = localStorage.getItem('id');

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = { audioTrack: null, videoTrack: null };
let isMicMuted = false;
let isVideoMuted = false;

async function startCall() {
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
            
            // AGGRESSIVE FIX: 
            // 1. Stop any current playback for this user
            user.videoTrack.stop();
            // 2. Wipe the container entirely
            remotePlayer.innerHTML = ""; 
            // 3. Play fresh
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
                // Ensure the video element is removed before adding text
                user.videoTrack.stop();
                remotePlayer.innerHTML = "<div class='cam-off-notice'>Camera Off</div>";
            }
        }
    });

    client.on("user-left", (user) => {
        const remotePlayer = document.getElementById(user.uid);
        if (remotePlayer) remotePlayer.remove();
    });

    await client.join(APP_ID, CHANNEL, null);
    [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    
    localTracks.videoTrack.play("local-player");
    await client.publish([localTracks.audioTrack, localTracks.videoTrack]);
}

// --- TOGGLE LOGIC ---
async function toggleVideo() {
    if (!localTracks.videoTrack) return;
    isVideoMuted = !isVideoMuted;
    await localTracks.videoTrack.setMuted(isVideoMuted);
    
    // Local fix: If we mute our own, show the text locally too
    const localContainer = document.getElementById("local-player");
    if (isVideoMuted) {
        localContainer.innerHTML = "<div class='cam-off-notice'>Camera Off</div>";
    } else {
        localContainer.innerHTML = "";
        localTracks.videoTrack.play("local-player");
    }
    
    document.getElementById("video-btn").innerText = isVideoMuted ? "Start Video" : "Stop Video";
}

// ... other functions (toggleMic, etc) stay the same

startCall();
