const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection
} = require('@discordjs/voice');
const SpotifyWebApi = require('spotify-web-api-node');
const SoundCloud = require('soundcloud-scraper');
const scdl = require('soundcloud-downloader').default;
const ytstream = require('yt-stream');
const axios = require("axios");
const sodium = require('libsodium-wrappers');
const { EventEmitter } = require('events');
const Genius = require("genius-lyrics");
const Lyrics = new Genius.Client();

(async () => {
  await sodium.ready;
})();

function convertMsToMinutesSeconds(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

class YukufyClient extends EventEmitter {
  constructor(client, { configApi, configPlayer }) {
    super();
    this.client = client;
    this.configApi = configApi;
    this.configPlayer = configPlayer;

    this.volume = configPlayer.defaultVolume;
    this.tokenExpirationTime = 0;

    this.spotifyApi = new SpotifyWebApi({
      clientId: configApi.clientId,
      clientSecret: configApi.clientSecret,
    });

    this.soundcloudClient = new SoundCloud.Client();
    this.soundcloudClientId = SoundCloud.keygen();

    this.player = createAudioPlayer();
    this.authenticateSpotify();

    this.queue = [];
    this.currentResource = null;
    this.currentTrack = null;
    this.lastTrackInfo = null;
    this.loop = false;
    this.isPlaying = false;

    this.leaveTimeout = null;

    this.player.on(AudioPlayerStatus.Idle, () => this.handleIdle());

    this.player.on(AudioPlayerStatus.Playing, () => {});

    this.player.on('error', (error) => {
      const track = this.lastTrackInfo;
      this.emit('playerError', this, error, track);
      this.playNextTrack();
    });

    setInterval(() => this.checkAndRefreshToken(), 30 * 60 * 1000);
  }

  async handleIdle() {
    this.isPlaying = false;
    this.currentTrack = null;
    this.currentResource = null;

    if (this.queue.length === 0) {
      this.emit('finishQueue', { client: this, track: this.lastTrackInfo });
      if (this.configPlayer.leaveOnEmptyQueue === true) {
        this.scheduleLeaveOnEmptyQueue();
      }
      return;
    }

    this.playNextTrack();
  }

  scheduleLeaveOnEmptyQueue() {
    if (this.leaveTimeout) clearTimeout(this.leaveTimeout);

    if (!this.configPlayer.leaveOnEmptyQueue) return;

    this.leaveTimeout = setTimeout(() => {
        const guildId = this.currentTrack?.guildId || this.lastTrackInfo?.guildId;
        if (!guildId) {
            console.error('Unable to determine guildId for connection check.');
            return;
        }

        const connection = getVoiceConnection(guildId);

        if (connection && this.queue.length === 0) {
            connection.destroy();
            this.player.stop();
            this.queue = [];
            this.currentTrack = null;
            this.currentResource = null;

            this.emit('emptyQueue', { client: this, track: this.lastTrackInfo });
        }
      }, this.configPlayer.leaveOnEmptyQueueCooldown || 30000);
    }

  async authenticateSpotify() {
    try {
      const data = await this.spotifyApi.clientCredentialsGrant();
      const accessToken = data.body['access_token'];
      const expiresIn = data.body['expires_in'];

      this.spotifyApi.setAccessToken(accessToken);
      this.tokenExpirationTime = Date.now() + expiresIn * 1000;
    } catch (error) {
      console.error('Error renewing Spotify token:', error);
    }
  }

  async checkAndRefreshToken() {
    if (Date.now() >= this.tokenExpirationTime) {
      console.log('Token expired, renewing...');
      await this.authenticateSpotify();
    } else {
      return;
    }
  }

  async search(query, source) {
    try {
      if (source === 'spotify') {
        const data = await this.spotifyApi.searchTracks(query);
        const tracks = data.body.tracks.items;

        if (!tracks || tracks.length === 0) {
          throw new Error('No results found on Spotify!');
        }

        return tracks.map((track) => ({
          title: track.name,
          artist: track.artists[0].name,
          url: track.external_urls.spotify,
          duration: convertMsToMinutesSeconds(track.duration_ms),
          id: track.id,
          source: 'spotify',
          likes: track.popularity,
          thumbnail: track.album.images[0]?.url
        }));
      } else if (source === 'soundcloud') {
        const scInfo = await scdl.search({
          query: query,
          limit: 10,
          resourceType: 'tracks',
          client_id: this.soundcloudClientId
        });

        if (!scInfo.collection || scInfo.collection.length === 0) {
          throw new Error('No results found on SoundCloud!');
        }

        return scInfo.collection.map((track) => ({
          title: track.title,
          artist: track.user.username,
          url: track.permalink_url,
          duration: convertMsToMinutesSeconds(track.duration),
          id: track.id,
          source: 'soundcloud',
          likes: track.likes_count,
          thumbnail: track.artwork_url
        }));
      }
    } catch (error) {
      console.error('Error searching for songs:', error);
      throw new Error('Error searching for songs');
    }
  }

  async play(query, channel, source, { member, textChannel, guildId }) {
    try {
      let connection = getVoiceConnection(channel.guild.id);
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
          connection.destroy();
          this.queue = [];
          this.currentTrack = null;
          this.currentResource = null;

          this.emit('clientDisconnect', { client: this, track: this.lastTrackInfo });
        });

        connection.subscribe(this.player);
      }

      const searchResult = await this.search(query, source);
      if (!searchResult || searchResult.length === 0) {
        throw new Error(`No music found`);
      }

      const track = searchResult[0];
      if (!track || track.duration <= 50000) {
        throw new Error(`The found track is less than 50 seconds or invalid.`);
      }

      const trackInfo = {
        url: track.url,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        source: track.source,
        likes: track.likes,
        thumbnail: track.thumbnail,
        member,
        textChannel,
        guildId,
      };

      this.queue.push(trackInfo);

      this.emit('addSong', {
        client: this,
        queue: this.queue,
        track: trackInfo,
      });

      if (!this.isPlaying) {
        this.playNextTrack();
      }

      return trackInfo;
    } catch (error) {
      console.error('Error playing music:', error);
      throw new Error('Error playing music');
    }
  }

  async playNextTrack() {
    if (this.queue.length === 0 && !this.loop) {
      this.isPlaying = false;

      if (this.configPlayer.leaveOnEmptyQueue === true) {
        this.scheduleLeaveOnEmptyQueue();
      }
      return;
    }

    this.isPlaying = true;

    const trackInfo = this.queue.shift() || this.currentTrack;

    if (this.loop && !this.queue.includes(trackInfo)) {
      this.queue.push(trackInfo);
    }

    this.currentTrack = trackInfo;
    this.lastTrackInfo = trackInfo;

    try {
      const searchResult = await ytstream.search(`${trackInfo.artist} ${trackInfo.title}`);
      if (!searchResult || searchResult.length === 0) {
        throw new Error('No results found on YouTube.');
      }

      const options = {
        method: 'GET',
        url: 'https://yt-api.p.rapidapi.com/dl',
        params: { id: searchResult[0].id },
        headers: {
          'x-rapidapi-key': '195d9d56f0mshf2ef5b15de50facp11ef65jsn7dbd159005d4',
          'x-rapidapi-host': 'yt-api.p.rapidapi.com'
        }
      };

      const response = await axios.request(options);

      if (!response.data || !response.data.formats || response.data.formats.length === 0) {
        throw new Error('Unable to get stream link.');
      }

      const streamUrl = response.data.formats[0].url;

      const resource = createAudioResource(streamUrl, {
        inlineVolume: true,
      });

      this.currentResource = resource;
      this.player.play(resource);
      resource.volume.setVolume(this.volume / 100);

      this.player.once(AudioPlayerStatus.Idle, () => {
        this.playNextTrack();
      });

      this.emit('playSong', {
        client: this,
        queue: this.queue,
        track: trackInfo,
      });

    } catch (error) {
      console.error("Error playing the music:", error);
      this.isPlaying = false;
    }
  }

  async toggleLoop() {
    this.loop = !this.loop;
    return this.loop;
  }

  async stop() {
    try {
      this.queue = [];
      this.player.stop();
      this.currentTrack = null;
      this.isPlaying = false;

      this.emit('deleteQueue', { client: this, track: this.lastTrackInfo });
    } catch (error) {
      console.error('Error stopping the music:', error);
      throw new Error('Error stopping the music');
    }
  }

  async skip() {
    try {
      if (this.queue.length > 0) {
        this.playNextTrack();
      } else {
        this.stop();
      }
    } catch (error) {
      console.error('Error skipping song:', error);
      throw new Error('Error skipping song');
    }
  }

  async pause() {
    try {
      if (this.player.state.status === 'paused') {
        return { status: 'alreadyPaused' };
      }
      this.player.pause();
      return { status: 'paused' };
    } catch (error) {
      console.error('Error pausing song:', error);
      throw new Error('Error pausing song');
    }
  }
  
  async resume() {
    try {
      if (this.player.state.status === 'playing') {
        return { status: 'alreadyPlaying' };
      }
      this.player.unpause();
      return { status: 'resumed' };
    } catch (error) {
      console.error('Error resuming song:', error);
      throw new Error('Error resuming song');
    }
  }

  async setVolume(volume) {
    try {
      if (volume < 0 || volume > 100) {
        throw new Error('Volume must be between 0 and 100.');
      }

      this.volume = volume;

      if (this.currentResource) {
        this.currentResource.volume.setVolume(this.volume / 100);
      }

    } catch (error) {
      console.error('Error adjusting volume:', error);
      throw new Error('Error adjusting volume');
    }
  }

  async getQueue() {
    if (this.queue.length === 0) {
      return [];
    }

    return this.queue.map((track, index) => ({
      position: index + 1,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      url: track.url,
      source: track.source,
      likes: track.likes,
      thumbnail: track.thumbnail,
      member: track.member,
      textChannel: track.textChannel,
      guildId: track.guildId,
    }));
  }

  async join(channel) {
    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      connection.on(VoiceConnectionStatus.Ready, () => {
        return;
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        connection.destroy();
        this.queue = [];
        this.currentTrack = null;
        this.currentResource = null;

        this.emit('clientDisconnect', { client: this, track: this.lastTrackInfo });
      });

      connection.subscribe(this.player);

      return;
    } catch (error) {
      console.error('Error joining voice channel:', error);
      throw new Error('Error joining voice channel');
    }
  }

  async leave(channelId) {
    try {
      const connection = getVoiceConnection(this.client.guilds.cache.find(g => g.channels.cache.get(channelId)).id);
      if (connection) {
        connection.destroy();
        this.queue = [];
        this.currentTrack = null;
        this.currentResource = null;

        this.emit('leaveChannel', { client: this, track: this.lastTrackInfo });
      }
    } catch (error) {
      console.error('Error leaving voice channel:', error);
      throw new Error('Error leaving voice channel');
    }
  }

  async nowPlaying() {
    if (!this.currentTrack || !this.currentResource) {
      return null;
    }

    const elapsedMs = this.player.state?.resource?.playbackDuration || 0;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = ((elapsedMs % 60000) / 1000).toFixed(0).padStart(2, '0');

    const [totalMinutes, totalSeconds] = this.currentTrack.duration.split(':').map(Number);
    const totalMs = (totalMinutes * 60 + totalSeconds) * 1000;

    const progressPercentage = ((elapsedMs / totalMs) * 100).toFixed(2);

    return {
      title: this.currentTrack.title,
      artist: this.currentTrack.artist,
      url: this.currentTrack.url,
      duration: this.currentTrack.duration,
      likes: this.currentTrack.likes,
      source: this.currentTrack.source,
      thumbnail: this.currentTrack.thumbnail,
      elapsedTime: `${elapsedMinutes}:${elapsedSeconds}/${this.currentTrack.duration} (${progressPercentage}%)`,
      member: this.currentTrack.member,
      textChannel: this.currentTrack.textChannel,
      guildId: this.currentTrack.guildId
    };
  }

  async lyrics(query) {
    try {
      const searches = await Lyrics.songs.search(query);

      const firstSong = searches[0];

      const lyrics = await firstSong.lyrics();
      return lyrics;
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      throw new Error('Error fetching lyrics');
    }
  }
}

module.exports = { YukufyClient };