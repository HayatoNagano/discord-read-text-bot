require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  entersState,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let isReading = false;
let connection = null;
const player = createAudioPlayer();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const voiceChannel = message.member.voice?.channel;

  // ===== joinコマンドでVC常駐 =====
  if (message.content === '!in') {
    if (!voiceChannel) return message.reply('❗VCに入ってから `!join` を使ってください。');

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    connection.subscribe(player);
    isReading = true;
    message.reply('🔊 VCに参加しました。発言を読み上げます！');
    return;
  }

  // ===== leaveコマンドで退出 =====
  if (message.content === '!out') {
    if (connection) {
      connection.destroy();
      connection = null;
      isReading = false;
      message.reply('👋 VCから退出しました。');
    } else {
      message.reply('❗まだVCに参加していません。');
    }
    return;
  }

  // ===== 読み上げ処理 =====
  if (!isReading || !connection) return;
  if (!voiceChannel || voiceChannel.id !== connection.joinConfig.channelId) return;

  const rawText = message.content.trim();
  if (!rawText) return;

  // === 猫語変換 ===
  const text = convertToNeko(rawText);

  if (!text) return;

  try {
    const speaker = process.env.SPEAKER_ID ? Number(process.env.SPEAKER_ID) : 3;
    const query = await axios.post(
      'http://127.0.0.1:50021/audio_query',
      null,
      { params: { text, speaker } }
    );

    const audioRes = await axios.post(
      'http://127.0.0.1:50021/synthesis',
      query.data,
      {
        params: { speaker },
        responseType: 'arraybuffer',
      }
    );

    const tempPath = path.join(__dirname, `voice-${Date.now()}.wav`);
    fs.writeFileSync(tempPath, Buffer.from(audioRes.data));

    const resource = createAudioResource(tempPath, {
      inputType: StreamType.Arbitrary,
    });

    player.play(resource);
    player.once(AudioPlayerStatus.Idle, () => {
      fs.unlinkSync(tempPath);
    });
  } catch (err) {
    console.error('TTSエラー:', err);
    message.reply('🚨 読み上げに失敗しました。VOICEVOXが起動しているか確認してください。');
  }
});

client.login(process.env.DISCORD_TOKEN);

function convertToNeko(text) {
  let nekoText = text;

  // よくある表現を先に猫語に変換
  nekoText = nekoText.replace(/(だよ|だね|だな)(?![ぁ-んァ-ン])/g, 'にゃ');
  nekoText = nekoText.replace(/(です|でしょ|でしょう)/g, 'にゃ');
  nekoText = nekoText.replace(/(ます|ましょう|ません)/g, 'にゃん');
  nekoText = nekoText.replace(/でした/g, 'だったにゃ');
  nekoText = nekoText.replace(/してください/g, 'してにゃん');
  nekoText = nekoText.replace(/してる/g, 'してるにゃ');
  nekoText = nekoText.replace(/して/g, 'してにゃ');

  // 文末の記号を猫語に変換
  nekoText = nekoText
    .replace(/[。．\.]/g, 'にゃ。')
    .replace(/[！!]/g, 'にゃ！')
    .replace(/[？?]/g, 'にゃ？');

  // 語尾ににゃがなければつける（安全策）
  if (!nekoText.trim().endsWith('にゃ') && !nekoText.includes('にゃ')) {
    nekoText += 'にゃ';
  }

  return nekoText;
}
