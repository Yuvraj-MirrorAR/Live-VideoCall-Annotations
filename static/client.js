const form = document.getElementById("room-name-form");
const roomNameInput = document.getElementById("room-name-input");
const userNameInput = document.getElementById("user-name-input")
const container = document.getElementById("video-container");
const clientTwilioStream = new MediaStream()
var  count = 0;
var room;
var token;
var client_video_element =null; 
// peer connection
var pc = null; 

// data channel
var dc = null, dcInterval = null;


const startRoom = async (event) => {
    // prevent a page reload when a user submits the form
    event.preventDefault();
    // hide the join form
    form.style.visibility = "hidden";
    // retrieve the room name
    const roomName = roomNameInput.value;
    const userName = userNameInput.value;
    var select = document.getElementById('MLModelSelect');
    var option = select.options[select.selectedIndex];
    
    // fetch an Access Token from the join-room route
    const response = await fetch("/join_room", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room_name: roomName, user_name: userName, model_name: option.value}),
    }).then(function(response) {
       
        return response.json();
    }).then(function(answer) {
        mytoken = answer.token;
        console.log(answer.token)
    }).catch(function(e) {
        alert(e);
    });
   
    room = await joinVideoRoom(roomName, mytoken);
    // render the local and remote participants' video and audio tracks
    handleConnectedParticipant(room.localParticipant);
      // handle cleanup when a participant disconnects
    room.on("participantDisconnected", handleDisconnectedParticipant);
    room.participants.forEach(handleConnectedParticipant);
    room.on("participantConnected", handleConnectedParticipant);
    // console.log(room);
    // console.log(token);
  };

  
  form.addEventListener("submit", startRoom);



  const joinVideoRoom = async (roomName, token) => {
    // join the video room with the Access Token and the given room name
    const room = await Twilio.Video.connect(token, {
      room: roomName,
      audio: false,
      video: true
    });
    return room;
  };
  const handleConnectedParticipant = (participant) => {
    // create a div for this participant's tracks
    const participantDiv = document.createElement("div");
    participantDiv.setAttribute("id", participant.identity);
    container.appendChild(participantDiv);
  
    // iterate through the participant's published tracks and
    // call `handleTrackPublication` on them
    participant.tracks.forEach((trackPublication) => {
      handleTrackPublication(trackPublication, participant);
    });
  
    // listen for any new track publications
    participant.on("trackPublished", handleTrackPublication);
  };
  const handleTrackPublication = (trackPublication, participant) => {
    function displayTrack(track) {

      // Get the participant's div
      const participantDiv = document.getElementById(participant.identity);

      // Only Doctor should see patient annotated frames
      if (room.localParticipant.identity == "Doctor" && participant.identity == "Patient") {
        // Doctor is receiving patients video track
        clientTwilioStream.addTrack(track.mediaStreamTrack)
        // append this track to participant div
        participantDiv.append(track.attach());
        // set our client_video_div_element 
        if (participant.identity == "Patient" && client_video_element == null) {
            client_video_element = participantDiv.firstChild;
        }
        // create aioRTC connect with same server and add patient track to it.
        StartAioRTCPeerConnection();
      }
      else {
        participantDiv.append(track.attach());
          
      }
     
    }
  
    // check if the trackPublication contains a `track` attribute. If it does,
    // we are subscribed to this track. If not, we are not subscribed.
    if (trackPublication.track) {
      displayTrack(trackPublication.track);
    }
  
    // listen for any new subscriptions to this track publication
    trackPublication.on("subscribed", displayTrack);
  };
  const handleDisconnectedParticipant = (participant) => {
    // stop listening for this participant
    participant.removeAllListeners();
    // remove this participant's div from the page
    const participantDiv = document.getElementById(participant.identity);
    participantDiv.remove();
  };


  











function createPeerConnection() {
    var config = {
        sdpSemantics: 'unified-plan'
    };

  

    pc = new RTCPeerConnection(config);

   
    // connect audio / video
    // check if the track is video  then add received stream from server to client_video_element source.
    pc.addEventListener('track', function(evt) {
        if (evt.track.kind == 'video')
            client_video_element.srcObject = evt.streams[0];
      
    });

    return pc;
}

function negotiate() {
    return pc.createOffer().then(function(offer) {
        return pc.setLocalDescription(offer);
    }).then(function() {
        // wait for ICE gathering to complete
        return new Promise(function(resolve) {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                function checkState() {
                    if (pc.iceGatheringState === 'complete') {
                        pc.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                }
                pc.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }).then(function() {
        var offer = pc.localDescription;
        var codec;

     
        codec = 'default'; // 
        if (codec !== 'default') {
            offer.sdp = sdpFilterCodec('video', codec, offer.sdp);
        }
        var select = document.getElementById('MLModelSelect');
        var option = select.options[select.selectedIndex];
        // document.getElementById('offer-sdp').textContent = offer.sdp;
        return fetch('/offer', {
            body: JSON.stringify({
                sdp: offer.sdp,
                type: offer.type,
                video_transform: option.value
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });
    }).then(function(response) {
        // console.log(response.json());
        return response.json();
    }).then(function(answer) {
       
        console.log("Aswer" + answer.sdp)

        return pc.setRemoteDescription(answer);
    }).catch(function(e) {
        alert(e);
    });
}






function StartAioRTCPeerConnection() {
    
    // Create a peer connection with server 

    pc = createPeerConnection();

    var time_start = null;

    function current_stamp() {
        if (time_start === null) {
            time_start = new Date().getTime();
            return 0;
        } else {
            return new Date().getTime() - time_start;
        }
    }

  

    var constraints = {
        audio: false,
        video: true
    };
    clientTwilioStream.getTracks().forEach(function(track) {
        pc.addTrack(track, clientTwilioStream);
    });
    return negotiate();
   

   
}

function stop() {
    document.getElementById('stop').style.display = 'none';

    // close data channel
    if (dc) {
        dc.close();
    }

    // close transceivers
    if (pc.getTransceivers) {
        pc.getTransceivers().forEach(function(transceiver) {
            if (transceiver.stop) {
                transceiver.stop();
            }
        });
    }

    // close local audio / video
    pc.getSenders().forEach(function(sender) {
        sender.track.stop();
    });

    // close peer connection
    setTimeout(function() {
        pc.close();
    }, 500);
}



function sdpFilterCodec(kind, codec, realSdp) {
    var allowed = []
    var rtxRegex = new RegExp('a=fmtp:(\\d+) apt=(\\d+)\r$');
    var codecRegex = new RegExp('a=rtpmap:([0-9]+) ' + escapeRegExp(codec))
    var videoRegex = new RegExp('(m=' + kind + ' .*?)( ([0-9]+))*\\s*$')
    
    var lines = realSdp.split('\n');

    var isKind = false;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('m=' + kind + ' ')) {
            isKind = true;
        } else if (lines[i].startsWith('m=')) {
            isKind = false;
        }

        if (isKind) {
            var match = lines[i].match(codecRegex);
            if (match) {
                allowed.push(parseInt(match[1]));
            }

            match = lines[i].match(rtxRegex);
            if (match && allowed.includes(parseInt(match[2]))) {
                allowed.push(parseInt(match[1]));
            }
        }
    }

    var skipRegex = 'a=(fmtp|rtcp-fb|rtpmap):([0-9]+)';
    var sdp = '';

    isKind = false;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('m=' + kind + ' ')) {
            isKind = true;
        } else if (lines[i].startsWith('m=')) {
            isKind = false;
        }

        if (isKind) {
            var skipMatch = lines[i].match(skipRegex);
            if (skipMatch && !allowed.includes(parseInt(skipMatch[2]))) {
                continue;
            } else if (lines[i].match(videoRegex)) {
                sdp += lines[i].replace(videoRegex, '$1 ' + allowed.join(' ')) + '\n';
            } else {
                sdp += lines[i] + '\n';
            }
        } else {
            sdp += lines[i] + '\n';
        }
    }

    return sdp;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}