const APP_ID = "79f80c0390e14a06adf7d98e3a0056af";
const CHANNEL = "main-room"; // Everyone needs the same channel name to see each other

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

async function startCall() {


    // 5. THE GROUP LOGIC: Listen for when others join
    client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
            // Create a new div for the classmate
            const remotePlayer = document.createElement("div");
            remotePlayer.id = user.uid; // Unique ID from Agora
            remotePlayer.className = "video-player";
            document.getElementById("video-container").append(remotePlayer);
            
            // Play their video in that div
            user.videoTrack.play(remotePlayer);
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
        }
    });

    // 1. Join the channel (Token is 'null' for Testing Mode)
    await client.join(APP_ID, CHANNEL, null);

    // 2. Access your camera and mic
    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    
    // 3. Show your video locally
    videoTrack.play("local-player");

    // 4. Send your video to the cloud so others see you
    await client.publish([audioTrack, videoTrack]);

    // 6. Cleanup when someone leaves
    client.on("user-left", (user) => {
        const remotePlayer = document.getElementById(user.uid);
        if (remotePlayer) remotePlayer.remove();
    });
}

startCall();
