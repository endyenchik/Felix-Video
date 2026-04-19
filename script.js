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
    // Listen for others BEFORE joining (The "Late Joiner" fix)
    client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
            const remotePlayer = document.createElement("div");
            remotePlayer.id = user.uid;
            remotePlayer.className = "video-player";
            document.getElementById("video-container").append(remotePlayer);
            user.videoTrack.play(remotePlayer);
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
        }
    });

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
    isMicMuted = !isMicMuted;
    await localTracks.audioTrack.setMuted(isMicMuted);
    document.getElementById("mic-btn").innerText = isMicMuted ? "Unmute Mic" : "Mute Mic";
}

async function toggleVideo() {
    isVideoMuted = !isVideoMuted;
    await localTracks.videoTrack.setMuted(isVideoMuted);
    document.getElementById("video-btn").innerText = isVideoMuted ? "Start Video" : "Stop Video";
}

async function leaveCall() {
    // Stop local hardware
    for (let trackName in localTracks) {
        let track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = null;
        }
    }

    // Leave the channel
    await client.leave();
    
    // Go back to the menu
    window.location.href = "index.html"; 
}

document.getElementById("mic-btn").onclick = toggleMic;
document.getElementById("video-btn").onclick = toggleVideo;

startCall();

window.onbeforeunload = function() {
    leaveCall();
};