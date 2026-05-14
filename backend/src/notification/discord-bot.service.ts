import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { Client, GatewayIntentBits, Message } from 'discord.js';

@Injectable()
export class DiscordBotService implements OnModuleInit {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('DISCORD_BOT_TOKEN');
    if (!token) {
      this.logger.warn('DISCORD_BOT_TOKEN not set, Discord bot disabled');
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    this.client.on('ready', () => {
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', (msg) => this.handleMessage(msg));
    this.client.on('messageReactionAdd', (reaction, user) => this.handleReaction(reaction, user));

    await this.client.login(token);
  }

  private async handleMessage(msg: Message) {
    if (msg.author.bot) return;

    if (msg.content.startsWith('!link')) {
      const stellarAddress = msg.content.split(' ')[1];
      if (!stellarAddress) {
        await msg.reply('Usage: !link <stellar_address>');
        return;
      }

      await this.prisma.discordMapping.upsert({
        where: { discordId: msg.author.id },
        create: { discordId: msg.author.id, stellarAddress },
        update: { stellarAddress },
      });

      await msg.reply(`✅ Linked Discord ID to ${stellarAddress}`);
      this.logger.log(`Linked Discord ${msg.author.id} to ${stellarAddress}`);
    }
  }

  private async handleReaction(reaction: any, user: any) {
    if (user.bot) return;

    const message = reaction.message;
    if (!message.content.includes('[PROPOSAL]')) return;

    const mapping = await this.prisma.discordMapping.findUnique({
      where: { discordId: user.id },
    });

    if (!mapping) {
      this.logger.warn(`User ${user.id} reacted but not linked to Stellar address`);
      return;
    }

    const emoji = reaction.emoji.name;
    const vote = emoji === '👍' ? 'YES' : emoji === '👎' ? 'NO' : null;

    if (vote) {
      this.logger.log(`Discord user ${user.id} voted ${vote} on proposal (Stellar: ${mapping.stellarAddress})`);
      // TODO: Submit vote on-chain via proxy or store in DB for batch submission
    }
  }

  async postProposal(channelId: string, proposalId: string, title: string, description: string) {
    if (!this.client) return;

    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const msg = await channel.send(`[PROPOSAL] **${title}**\n${description}\n\nReact 👍 or 👎 to vote!`);
      await msg.react('👍');
      await msg.react('👎');
      this.logger.log(`Posted proposal ${proposalId} to Discord channel ${channelId}`);
    }
  }
}
