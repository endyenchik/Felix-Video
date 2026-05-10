const APP_ID = "2bb254f4f40940dc945729ec63a55209";
const CHANNEL = localStorage.getItem('id');
const MY_NAME = localStorage.getItem('name') || 'Anonymous';

const SUPABASE_URL = "https://ggoztuecpxhrylxkhnbj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnb3p0dWVjcHhocnlseGtobmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODI5OTgsImV4cCI6MjA5MjQ1ODk5OH0.evQGuz9iHMB--oxkL8XlvnMPkqWK_QiRTWoqk4qhdGI"; // paste your anon key here

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = { audioTrack: null, videoTrack: null };
let screenTrack = null;
let screenClient = null;
let isMicMuted = false;
let isVideoMuted = false;
let isScreenSharing = false;
let nameMap = {}; // uid -> name

// --- NAME TAGS ---

function setNameTag(playerEl, name) {
    let tag = playerEl.querySelector('.name-tag');
    if (!tag) {
        tag = document.createElement('div');
        tag.className = 'name-tag';
        playerEl.appendChild(tag);
    }
    tag.textContent = name;
}

function updateAllNameTags() {
    Object.entries(nameMap).forEach(([uid, name]) => {
        const player = document.getElementById(`player-${uid}`)
                    || (String(uid) === String(client.uid) ? document.getElementById('local-player') : null);
        if (player) setNameTag(player, name);
    });
}

async function initPresence() {
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const channel = sb.channel(`room:${CHANNEL}`, {
        config: { presence: { key: String(client.uid) } }
    });

    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            nameMap = {};
            Object.entries(state).forEach(([uid, presences]) => {
                nameMap[uid] = presences[0].name;
            });
            updateAllNameTags();
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ name: MY_NAME });
            }
        });
}

// --- UI HELPER FUNCTIONS ---

function updateParticipantCount() {
    const totalPeople = client.remoteUsers.filter(u => u.uid !== 1).length + 1;
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
    if (isScreenSharing) return;

    isVideoMuted = !isVideoMuted;
    await localTracks.videoTrack.setMuted(isVideoMuted);

    const localContainer = document.getElementById("local-player");
    const btn = document.getElementById("video-btn");

    if (isVideoMuted) {
        localContainer.innerHTML = '<img src="icons/cam-off.png" height="300" width="300" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.7;">';
        setNameTag(localContainer, MY_NAME);  // add this
        btn.innerText = "Start Video";
        btn.style.backgroundColor = "red";
    } else {
        localContainer.innerHTML = "";
        localTracks.videoTrack.play("local-player");
        setNameTag(localContainer, MY_NAME);  // already there
        btn.innerText = "Stop Video";
        btn.style.backgroundColor = "gray";
    }
}

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

            const container = document.getElementById("video-container");
            container.style.cssText = "";
            container.innerHTML = "";

            const localPlayer = document.createElement("div");
            localPlayer.id = "local-player";
            localPlayer.className = "video-player";
            container.appendChild(localPlayer);

            if (!isVideoMuted) {
                localTracks.videoTrack.play("local-player");
                setNameTag(localPlayer, MY_NAME);
            }

            client.remoteUsers.forEach(user => {
                if (user.uid === 1) return;
                if (user.videoTrack) {
                    const remotePlayer = document.createElement("div");
                    remotePlayer.id = `player-${user.uid}`;
                    remotePlayer.className = "video-player";
                    container.appendChild(remotePlayer);
                    user.videoTrack.play(remotePlayer);
                    if (nameMap[user.uid]) setNameTag(remotePlayer, nameMap[user.uid]);
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

            const video = document.createElement("video");
            video.autoplay = true;
            video.playsInline = true;
            video.style.cssText = `width: ${container.clientWidth}px; height: ${container.clientHeight}px; display: block; object-fit: contain;`;
            video.srcObject = new MediaStream([rawTrack]);
            container.appendChild(video);
            video.play();

            isScreenSharing = true;
            document.getElementById("screen-share-btn").innerText = "Stop Sharing";
            document.getElementById("screen-share-btn").style.backgroundColor = "green";

            rawTrack.onended = async () => {
                if (isScreenSharing) await toggleScreenShare();
            };
        }
    } catch (e) {
        console.error("Screen sharing error:", e);
    }
}

let sfxTrack;

async function playSound(fileName) {
    try {
        if (sfxTrack) {
            await client.unpublish(sfxTrack);
            sfxTrack.stop();
            sfxTrack.close();
        }

        sfxTrack = await AgoraRTC.createBufferSourceAudioTrack({ source: fileName });
        sfxTrack.startProcessAudioBuffer({ loop: false });
        sfxTrack.play();
        await client.publish(sfxTrack);
    } catch (e) {
        console.error("Soundboard Error:", e);
    }
}

// --- CORE AGORA LOGIC ---

async function startCall() {
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
                video.style.cssText = `width: ${container.clientWidth}px; height: ${container.clientHeight}px; display: block; object-fit: contain;`;
                video.srcObject = new MediaStream([track.getMediaStreamTrack()]);
                container.appendChild(video);
                video.play();
            } else {
                let remotePlayer = document.getElementById(`player-${user.uid}`);
                if (!remotePlayer) {
                    remotePlayer = document.createElement("div");
                    remotePlayer.id = `player-${user.uid}`;
                    remotePlayer.className = "video-player";
                    document.getElementById("video-container").append(remotePlayer);
                }
                remotePlayer.innerHTML = "";
                track.play(remotePlayer);
                if (nameMap[user.uid]) setNameTag(remotePlayer, nameMap[user.uid]);
            }
        }

        if (mediaType === "audio") user.audioTrack.play();
        updateParticipantCount();
        updateAllNameTags();
    });

    client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
            const remotePlayer = document.getElementById(`player-${user.uid}`);
            if (remotePlayer) {
                remotePlayer.innerHTML = '<img src="icons/cam-off.png" height="300" width="300" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.7;">';
                if (nameMap[user.uid]) setNameTag(remotePlayer, nameMap[user.uid]); // add this
            }
        }
    });

    client.on("user-left", (user) => {
        if (user.uid === 1) {
            const container = document.getElementById("video-container");
            container.innerHTML = "";
            container.style.cssText = "";

            const localPlayer = document.createElement("div");
            localPlayer.id = "local-player";
            localPlayer.className = "video-player";
            container.appendChild(localPlayer);

            if (!isVideoMuted) {
                localTracks.videoTrack.play("local-player");
                setNameTag(localPlayer, MY_NAME);
            }

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
                        if (nameMap[u.uid]) setNameTag(remotePlayer, nameMap[u.uid]);
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

    await client.join(APP_ID, CHANNEL, null);
    [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

    localTracks.videoTrack.play("local-player");
    await client.publish([localTracks.audioTrack, localTracks.videoTrack]);

    setNameTag(document.getElementById('local-player'), MY_NAME);

    await initPresence();
    updateParticipantCount();
}

// --- INITIALIZATION ---

startCall();

document.getElementById("video-btn").onclick = toggleVideo;
document.getElementById("mic-btn").onclick = toggleMic;
document.getElementById("screen-share-btn").onclick = toggleScreenShare;

const soundBtn = document.getElementById("sound-bar");
if (soundBtn) soundBtn.onclick = showSounds;

window.addEventListener('resize', () => {
    const totalPeople = client.remoteUsers.filter(u => u.uid !== 1).length + 1;
    videoResize(totalPeople);
});