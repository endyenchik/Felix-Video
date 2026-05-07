const APP_ID = "2bb254f4f40940dc945729ec63a55209";
const CHANNEL = localStorage.getItem('id');

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = { audioTrack: null, videoTrack: null };
let screenTrack = null;
let isMicMuted = false;
let isVideoMuted = false;
let isScreenSharing = false;
let remoteScreenTracks = {}; // Track screen shares by user UID

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
    if (isScreenSharing) return; // Can't toggle video while screen sharing
    
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

async function toggleScreenShare() {
    try {
        if (isScreenSharing) {
            // Stop screen sharing
            await client.unpublish(screenTrack);
            screenTrack.stop();
            screenTrack.close();
            screenTrack = null;
            isScreenSharing = false;

            // Republish camera
            await client.publish([localTracks.audioTrack, localTracks.videoTrack]);
            if (!isVideoMuted) {
                localTracks.videoTrack.play("local-player");
            }

            document.getElementById("screen-player").style.display = "none";
            document.getElementById("screen-player").innerHTML = "";

            const btn = document.getElementById("screen-share-btn");
            btn.innerText = "Share Screen";
            btn.style.backgroundColor = "gray";
        } else {
            // Start screen sharing
            if (!localTracks.videoTrack) return;
            
            screenTrack = await AgoraRTC.createScreenVideoTrack({
                encoderConfig: "1080p_1"
            });

            // Unpublish camera, publish screen
            await client.unpublish(localTracks.videoTrack);
            await client.publish(screenTrack);
            
            screenTrack.play("screen-player");
            document.getElementById("screen-player").style.display = "block";
            isScreenSharing = true;
            isVideoMuted = false;

            const btn = document.getElementById("screen-share-btn");
            btn.innerText = "Stop Sharing";
            btn.style.backgroundColor = "green";

            // Handle screen share stop (user clicks stop in browser dialog)
            screenTrack.on("track-ended", async () => {
                if (isScreenSharing) {
                    await toggleScreenShare();
                }
            });
        }
    } catch (e) {
        console.error("Screen sharing error:", e);
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
            // Check if this is a screen share (second video from same user)
            const isScreenShare = remoteScreenTracks[user.uid] !== undefined;
            const windowId = isScreenShare ? `${user.uid}-screen` : user.uid;
            const className = isScreenShare ? "video-player" : "video-player";
            
            let remotePlayer = document.getElementById(windowId);
            if (!remotePlayer) {
                remotePlayer = document.createElement("div");
                remotePlayer.id = windowId;
                remotePlayer.className = className;
                if (isScreenShare) {
                    remotePlayer.style.border = "2px solid #00ff00"; // Green border for screen share
                }
                document.getElementById("video-container").append(remotePlayer);
            }
            remotePlayer.innerHTML = ""; 
            user.videoTrack.play(remotePlayer);
            
            // Track this as a screen share if it's the second video
            if (isScreenShare) {
                remoteScreenTracks[user.uid] = windowId;
            } else {
                remoteScreenTracks[user.uid] = false; // Mark that we have their camera
            }
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
        }
        updateParticipantCount();
    });

    // Handle remote users muting/unmuting
    client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
            // Check if this is a screen share window
            const screenWindowId = `${user.uid}-screen`;
            const screenPlayer = document.getElementById(screenWindowId);
            
            if (screenPlayer) {
                // This is a screen share, remove it
                screenPlayer.remove();
                delete remoteScreenTracks[user.uid];
            } else {
                // This is the camera, show camera off
                const remotePlayer = document.getElementById(user.uid);
                if (remotePlayer) {
                    remotePlayer.innerHTML = "<div class='cam-off-notice'>Camera Off</div>";
                }
            }
        }
    });

    // Handle users leaving
    client.on("user-left", (user) => {
        const remotePlayer = document.getElementById(user.uid);
        if (remotePlayer) remotePlayer.remove();
        
        // Also remove screen share window if exists
        const screenWindowId = `${user.uid}-screen`;
        const screenPlayer = document.getElementById(screenWindowId);
        if (screenPlayer) screenPlayer.remove();
        
        delete remoteScreenTracks[user.uid];
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
document.getElementById("screen-share-btn").onclick = toggleScreenShare;

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