const APP_ID = "2bb254f4f40940dc945729ec63a55209";
const CHANNEL = localStorage.getItem('id');

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = { audioTrack: null, videoTrack: null };
let isMicMuted = false;
let isVideoMuted = false;

function updateParticipantCount() {
    const totalPeople = client.remoteUsers.length + 1;
    
    const countDisplay = document.getElementById('participant-count');
    if (countDisplay) {
        countDisplay.innerText = `People in call: ${totalPeople}`;
    }
    
    // Pass the count directly to the resize function
    videoResize(totalPeople);
}

function videoResize(totalPeople) {
    // 1. Grab the elements INSIDE the function to avoid ReferenceErrors
    const windows = document.getElementsByClassName("video-player");
    
    // If there are no windows yet, just stop
    if (windows.length === 0) return;

    let w, h;

    // 2. Logic (with fixed typos)
    if (totalPeople <= 1) {
        w = window.innerWidth + 'px';
        h = window.innerHeight + 'px';
    } else if (totalPeople <= 2) {
        w = (window.innerWidth / 2) + 'px';
        h = window.innerHeight + 'px';
    } else if (totalPeople <= 4) {
        w = (window.innerWidth / 2) + 'px';
        h = (window.innerHeight / 2) + 'px';
    } else if (totalPeople <= 6) {
        w = (window.innerWidth / 3) + 'px';
        h = (window.innerHeight / 2) + 'px';
    } else if (totalPeople <= 8) {
        w = (window.innerWidth / 4) + 'px';
        h = (window.innerHeight / 2) + 'px';
    } else if (totalPeople <= 12) {
        w = (window.innerWidth / 4) + 'px';
        h = (window.innerHeight / 3) + 'px';
    } else {
        w = (window.innerWidth / 5) + 'px';
        h = (window.innerHeight / 3) + 'px';
    }

    // 3. Apply to all windows in the collection
    for (let i = 0; i < windows.length; i++) {
        windows[i].style.width = w;
        windows[i].style.height = h;
    }
}

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
        updateParticipantCount();
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
        updateParticipantCount();
    });

    await client.join(APP_ID, CHANNEL, null);
    [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    
    localTracks.videoTrack.play("local-player");
    await client.publish([localTracks.audioTrack, localTracks.videoTrack]);

    updateParticipantCount();
}

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


document.getElementById("video-btn").onclick = toggleVideo;
document.getElementById("mic-btn").onclick = toggleMic;

startCall();

window.addEventListener('resize', () => {
    const totalPeople = client.remoteUsers.length + 1;
    videoResize(totalPeople);
});