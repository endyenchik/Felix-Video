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

let screenClient = null;

async function toggleScreenShare() {
    try {
        if (isScreenSharing) {
            await screenClient.unpublish(screenTrack);
            screenTrack.stop();
            screenTrack.close();
            screenTrack = null;
            await screenClient.leave();
            screenClient = null;
            isScreenSharing = false;

            // Restore video container
            const container = document.getElementById("video-container");
            container.style.cssText = "";
            container.innerHTML = "";

            // Re-add local player
            const localPlayer = document.createElement("div");
            localPlayer.id = "local-player";
            localPlayer.className = "video-player";
            container.appendChild(localPlayer);

            if (!isVideoMuted) localTracks.videoTrack.play("local-player");

            // Re-add remote players
            client.remoteUsers.forEach(user => {
                if (user.videoTrack) {
                    const remotePlayer = document.createElement("div");
                    remotePlayer.id = `player-${user.uid}`;
                    remotePlayer.className = "video-player";
                    container.appendChild(remotePlayer);
                    user.videoTrack.play(remotePlayer);
                }
            });

            document.getElementById("screen-share-btn").innerText = "Share Screen";
            document.getElementById("screen-share-btn").style.backgroundColor = "gray";
            updateParticipantCount();
        } else {
            if (!localTracks.videoTrack) return;

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "monitor" },
                audio: false
            });
            const rawTrack = stream.getVideoTracks()[0];
            screenTrack = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: rawTrack });
            screenClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            await screenClient.join(APP_ID, CHANNEL, null, 1);
            await screenClient.publish(screenTrack);

            const container = document.getElementById("video-container");
            container.innerHTML = "";
            container.style.cssText = "width: 100vw; height: calc(100vh - 70px); display: block; background: #000;";

            const screenDiv = document.createElement("div");
            screenDiv.id = "screen-player";
            screenDiv.style.cssText = "width: 100%; height: 100%;";
            container.appendChild(screenDiv);

            // Play AFTER the div is in the DOM
            await new Promise(resolve => setTimeout(resolve, 100));
            screenTrack.play("screen-player");
            setTimeout(() => {
                const agDiv = document.querySelector("#screen-player > div");
                if (agDiv) agDiv.style.backgroundColor = "transparent";
            }, 200);

            isScreenSharing = true;
            document.getElementById("screen-share-btn").innerText = "Stop Sharing";
            document.getElementById("screen-share-btn").style.backgroundColor = "green";

            screenTrack.on("track-ended", async () => {
                if (isScreenSharing) await toggleScreenShare();
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
            const track = user.videoTrack;

            if (user.uid === 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const container = document.getElementById("video-container");
                container.innerHTML = "";
                container.style.cssText = "width: 100vw; height: calc(100vh - 70px); display: block; background: #000;";

                const video = document.createElement("video");
                video.autoplay = true;
                video.playsInline = true;
                video.style.cssText = "width: 100%; height: 100%; object-fit: contain;";
                video.srcObject = new MediaStream([track.getMediaStreamTrack()]);
                container.appendChild(video);
                video.play();
            }
            else {
                let remotePlayer = document.getElementById(`player-${user.uid}`);
                if (!remotePlayer) {
                    remotePlayer = document.createElement("div");
                    remotePlayer.id = `player-${user.uid}`;
                    remotePlayer.className = "video-player";
                    document.getElementById("video-container").append(remotePlayer);
                }
                remotePlayer.innerHTML = "";
                track.play(remotePlayer);
            }
        }

        if (mediaType === "audio") user.audioTrack.play();
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
                const remotePlayer = document.getElementById(`player-${user.uid}`);
                if (remotePlayer) {
                    remotePlayer.innerHTML = "<div class='cam-off-notice'>Camera Off</div>";
                }
            }
        }
    });

    // Handle users leaving
    client.on("user-left", (user) => {
        if (user.uid === 1) {
            const container = document.getElementById("video-container");
            container.innerHTML = "";
            container.style.cssText = "";

            const localPlayer = document.createElement("div");
            localPlayer.id = "local-player";
            localPlayer.className = "video-player";
            container.appendChild(localPlayer);

            if (!isVideoMuted) localTracks.videoTrack.play("local-player");

            // Small delay to let Agora settle before replaying remote tracks
            setTimeout(() => {
                client.remoteUsers.forEach(u => {
                    if (u.videoTrack && u.uid !== 1) {
                        let remotePlayer = document.getElementById(`player-${u.uid}`);
                        if (!remotePlayer) {
                            remotePlayer = document.createElement("div");
                            remotePlayer.id = `player-${u.uid}`;
                            remotePlayer.className = "video-player";
                            container.appendChild(remotePlayer);
                        }
                        u.videoTrack.play(remotePlayer);
                    }
                });
                updateParticipantCount();
            }, 500);

            return;
        }
        const remotePlayer = document.getElementById(`player-${user.uid}`);
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