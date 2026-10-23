// One RTCPeerConnection to one other huddle participant (P2P mesh).
// Every connection carries exactly one audio and one video transceiver, so
// turning the camera / screen share on or off is a replaceTrack() on the
// video sender - no renegotiation needed.
import { ICE_SERVERS } from './webrtc';
import type { HuddleSignalType } from '@/types/huddle';

export type OutgoingTracks = () => {
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
};

type PeerEvents = {
  signal: (type: HuddleSignalType, data: unknown) => void;
  change: () => void;
};

export class HuddlePeer {
  readonly pc: RTCPeerConnection;
  readonly stream = new MediaStream();
  private audioTx: RTCRtpTransceiver | null = null;
  private videoTx: RTCRtpTransceiver | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(
    readonly initiator: boolean,
    private readonly outgoing: OutgoingTracks,
    private readonly events: PeerEvents,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.events.signal('ice', event.candidate.toJSON());
    };
    this.pc.ontrack = (event) => {
      if (!this.stream.getTracks().includes(event.track)) {
        this.stream.addTrack(event.track);
      }
      event.track.onunmute = () => this.events.change();
      this.events.change();
    };
    this.pc.onconnectionstatechange = () => this.events.change();
  }

  get state(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  get answered() {
    return Boolean(this.pc.remoteDescription);
  }

  // Initiator side: create both transceivers and send the offer.
  async start() {
    const { audio, video } = this.outgoing();
    this.audioTx = this.pc.addTransceiver(audio ?? 'audio', { direction: 'sendrecv' });
    this.videoTx = this.pc.addTransceiver('video', { direction: 'sendrecv' });
    if (video) await this.videoTx.sender.replaceTrack(video);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.events.signal('offer', offer);
  }

  async handle(type: HuddleSignalType, data: unknown) {
    if (this.closed) return;
    if (type === 'offer') {
      await this.pc.setRemoteDescription(data as RTCSessionDescriptionInit);
      await this.attachToOfferedTransceivers();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.events.signal('answer', answer);
      await this.flushIce();
    } else if (type === 'answer') {
      if (this.pc.signalingState !== 'have-local-offer') return;
      await this.pc.setRemoteDescription(data as RTCSessionDescriptionInit);
      await this.flushIce();
    } else if (type === 'ice') {
      const candidate = data as RTCIceCandidateInit;
      // Candidates can arrive before the remote description: queue them.
      if (!this.pc.remoteDescription) this.pendingIce.push(candidate);
      else await this.pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  private async attachToOfferedTransceivers() {
    const { audio, video } = this.outgoing();
    for (const transceiver of this.pc.getTransceivers()) {
      const kind = transceiver.receiver.track.kind;
      transceiver.direction = 'sendrecv';
      if (kind === 'audio' && !this.audioTx) {
        this.audioTx = transceiver;
        await transceiver.sender.replaceTrack(audio);
      } else if (kind === 'video' && !this.videoTx) {
        this.videoTx = transceiver;
        await transceiver.sender.replaceTrack(video);
      }
    }
  }

  private async flushIce() {
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of queued) {
      await this.pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  async setVideoTrack(track: MediaStreamTrack | null) {
    await this.videoTx?.sender.replaceTrack(track).catch(() => undefined);
  }

  async setAudioTrack(track: MediaStreamTrack | null) {
    await this.audioTx?.sender.replaceTrack(track).catch(() => undefined);
  }

  close() {
    this.closed = true;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
  }
}
