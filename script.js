const APP_ID = "2bb254f4f40940dc945729ec63a55209";
const CHANNEL = localStorage.getItem('id');

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = { audioTrack: null, videoTrack: null };
let isMicMuted = false;
let isVideoMuted = false;

// --- UI HELPER FUNCTIONS ---

function updateParticipantCount() {
    const totalPeople = client.remoteUsers.length + 1;
    const countDisplay = document.getElementById('participant-count');
    if (countDisplay) {
        countDisplay.innerText = `People in call: ${totalPeople}`;
    }
    videoResize(totalPeople);
}

function videoResize(totalPeople) {
    const windows = document.getElementsByClassName("video-player");
    if (windows.length === 0) return;

    let w, h;
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

    for (let i = 0; i < windows.length; i++) {
        windows[i].style.width = w;
        windows[i].style.height = h;
    }
}

function showSounds() {
    const list = document.getElementById("soundList");
    if (!list) return;

    // Fixed toggle logic: if it's currently flex, hide it. Otherwise, show it.
    if (list.style.display === "flex") {
        list.style.display = "none";
    } else {
        list.style.display = "flex";
    }
}

// --- CALL CONTROL FUNCTIONS ---

async function toggleMic() {
    if (!localTracks.audioTrack) return;
    isMicMuted = !isMicMuted;
    await localTracks.audioTrack.setMuted(isMicMuted);
    
    const btn = document.getElementById("mic-btn");
    
    // Switch between mic-on and mic-off images
    if (isMicMuted) {
        btn.innerHTML = '<img src="icons/mic-off.png" height="30" width="30">';
        btn.style.backgroundColor = "red";
    } else {
        btn.innerHTML = '<img src="icons/micro.png" height="30" width="30">';
        btn.style.backgroundColor = "gray";
    }
}

async function toggleVideo() {
    if (!localTracks.videoTrack) return;
    isVideoMuted = !isVideoMuted;
    await localTracks.videoTrack.setMuted(isVideoMuted);
    
    const localContainer = document.getElementById("local-player");
    const btn = document.getElementById("video-btn");

    if (isVideoMuted) {
        localContainer.innerHTML = "<div class='cam-off-notice'>Camera Off</div>";
        btn.innerText = "Start Video";
        btn.style.backgroundColor = "red";
    } else {
        localContainer.innerHTML = "";
        localTracks.videoTrack.play("local-player");
        btn.innerText = "Stop Video";
        btn.style.backgroundColor = "gray";
    }
}

let sfxTrack; // To keep track of the current sound

async function playSound(fileName) {
    try {
        if (sfxTrack) {
            await client.unpublish(sfxTrack);
            sfxTrack.stop();
            sfxTrack.close();
        }

        sfxTrack = await AgoraRTC.createBufferSourceAudioTrack({
            source: fileName,
        });

        sfxTrack.startProcessAudioBuffer({ loop: false });

        // --- THE FIX ---
        sfxTrack.play(); // This plays the sound through YOUR speakers
        // ---------------

        await client.publish(sfxTrack);
        
        console.log("Playing and listening to:", fileName);

    } catch (e) {
        console.error("Soundboard Error:", e);
    }
}

// --- CORE AGORA LOGIC ---

async function startCall() {
    // Handle remote users publishing tracks
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
            remotePlayer.innerHTML = ""; 
            user.videoTrack.play(remotePlayer);
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
        }
        updateParticipantCount();
    });

    // Handle remote users muting/unmuting
    client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
            const remotePlayer = document.getElementById(user.uid);
            if (remotePlayer) {
                remotePlayer.innerHTML = "<div class='cam-off-notice'>Camera Off</div>";
            }
        }
    });

    // Handle users leaving
    client.on("user-left", (user) => {
        const remotePlayer = document.getElementById(user.uid);
        if (remotePlayer) remotePlayer.remove();
        updateParticipantCount();
    });

    // Join and create local tracks
    await client.join(APP_ID, CHANNEL, null);
    [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    
    localTracks.videoTrack.play("local-player");
    await client.publish([localTracks.audioTrack, localTracks.videoTrack]);

    updateParticipantCount();
}

// --- INITIALIZATION ---

// 1. Run the call setup
startCall();

// 2. Attach button listeners (ensure IDs match your HTML)
document.getElementById("video-btn").onclick = toggleVideo;
document.getElementById("mic-btn").onclick = toggleMic;

// Make sure your sound button has id="sound-bar" in HTML
const soundBtn = document.getElementById("sound-bar");
if (soundBtn) {
    soundBtn.onclick = showSounds;
}

// 3. Handle window resizing
window.addEventListener('resize', () => {
    const totalPeople = client.remoteUsers.length + 1;
    videoResize(totalPeople);
});