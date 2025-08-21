const { Client, GatewayIntentBits, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ============ CONFIGURAÇÕES DO BOT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============ DADOS DO SISTEMA ============
let botConfig = {
    activeHierarchy: 'pmmg',
    logChannel: null,
    robloxTimeEnabled: false,
    recruitRoles: [], // IDs dos cargos que podem recrutar
    promoteRoles: [], // IDs dos cargos que podem promover
    citizenRole: null, // ID do cargo "Cidadão"
    minRobloxHours: 10
};

// Base de dados simples para cooldowns e tempos
let userData = {}; // { userId: { joinDate: Date, lastAction: Date, currentRank: string } }
let cooldowns = {}; // { userId: { lastPromotion: Date, lastDemotion: Date } }

// ============ HIERARQUIAS E PATENTES ============
const hierarchies = {
    pmmg: {
        name: "PMMG - Polícia Militar de Minas Gerais",
        ranks: [
            { name: "Soldado", level: 1, minDays: 0, color: "#808080" },
            { name: "Cabo", level: 2, minDays: 1, color: "#00FF00" },
            { name: "3º Sargento", level: 3, minDays: 3, color: "#FFFF00" },
            { name: "2º Sargento", level: 4, minDays: 5, color: "#FF8000" },
            { name: "1º Sargento", level: 5, minDays: 7, color: "#FF0000" },
            { name: "Sub-Tenente", level: 6, minDays: 10, color: "#800080" },
            { name: "2º Tenente", level: 7, minDays: 14, color: "#0080FF" },
            { name: "1º Tenente", level: 8, minDays: 18, color: "#0000FF" },
            { name: "Capitão", level: 9, minDays: 21, color: "#000080" },
            { name: "Major", level: 10, minDays: 25, color: "#FFD700" },
            { name: "Tenente-Coronel", level: 11, minDays: 30, color: "#FF4500" },
            { name: "Coronel", level: 12, minDays: 35, color: "#8B0000" }
        ]
    },
    exercito: {
        name: "Exército Brasileiro",
        ranks: [
            { name: "Recruta", level: 1, minDays: 0, color: "#808080" },
            { name: "Soldado", level: 2, minDays: 2, color: "#00FF00" },
            { name: "Cabo", level: 3, minDays: 4, color: "#FFFF00" },
            { name: "3º Sargento", level: 4, minDays: 6, color: "#FF8000" },
            { name: "2º Sargento", level: 5, minDays: 8, color: "#FF0000" },
            { name: "1º Sargento", level: 6, minDays: 12, color: "#800080" },
            { name: "Sub-Tenente", level: 7, minDays: 16, color: "#0080FF" },
            { name: "Aspirante", level: 8, minDays: 20, color: "#0000FF" },
            { name: "2º Tenente", level: 9, minDays: 24, color: "#000080" },
            { name: "1º Tenente", level: 10, minDays: 28, color: "#FFD700" },
            { name: "Capitão", level: 11, minDays: 32, color: "#FF4500" },
            { name: "Major", level: 12, minDays: 40, color: "#8B0000" },
            { name: "Tenente-Coronel", level: 13, minDays: 50, color: "#4B0082" },
            { name: "Coronel", level: 14, minDays: 60, color: "#2F4F4F" },
            { name: "General", level: 15, minDays: 70, color: "#1C1C1C" },
            { name: "Marechal", level: 16, minDays: 90, color: "#FFD700" }
        ]
    },
    delegado: {
        name: "Delegado (PRF/PC)",
        ranks: [
            { name: "Agente", level: 1, minDays: 0, color: "#808080" },
            { name: "Investigador", level: 2, minDays: 3, color: "#00FF00" },
            { name: "Inspetor", level: 3, minDays: 7, color: "#FFFF00" },
            { name: "Comissário", level: 4, minDays: 14, color: "#FF8000" },
            { name: "Delegado Substituto", level: 5, minDays: 21, color: "#FF0000" },
            { name: "Delegado", level: 6, minDays: 30, color: "#8B0000" }
        ]
    },
    administrativo: {
        name: "Administrativo (RP/Staff)",
        ranks: [
            { name: "Estagiário", level: 1, minDays: 0, color: "#808080" },
            { name: "Assistente", level: 2, minDays: 2, color: "#00FF00" },
            { name: "Analista", level: 3, minDays: 5, color: "#FFFF00" },
            { name: "Supervisor", level: 4, minDays: 10, color: "#FF8000" },
            { name: "Coordenador", level: 5, minDays: 15, color: "#FF0000" },
            { name: "Gerente", level: 6, minDays: 20, color: "#800080" },
            { name: "Diretor", level: 7, minDays: 25, color: "#0000FF" },
            { name: "Co-CEO", level: 8, minDays: 35, color: "#FFD700" },
            { name: "CEO", level: 9, minDays: 50, color: "#8B0000" }
        ]
    }
};

// ============ FUNÇÕES UTILITÁRIAS ============
function getCurrentHierarchy() {
    return hierarchies[botConfig.activeHierarchy] || hierarchies.pmmg;
}

function getRankByName(rankName) {
    const hierarchy = getCurrentHierarchy();
    return hierarchy.ranks.find(rank => rank.name === rankName);
}

function getRankByLevel(level) {
    const hierarchy = getCurrentHierarchy();
    return hierarchy.ranks.find(rank => rank.level === level);
}

function canPromote(userId, currentRank) {
    const user = userData[userId];
    if (!user) return { canPromote: false, reason: "Usuário não encontrado no sistema" };
    
    const rank = getRankByName(currentRank);
    if (!rank) return { canPromote: false, reason: "Patente atual não encontrada" };
    
    const nextRank = getRankByLevel(rank.level + 1);
    if (!nextRank) return { canPromote: false, reason: "Não há patente superior disponível" };
    
    const daysPassed = Math.floor((Date.now() - user.joinDate) / (1000 * 60 * 60 * 24));
    
    if (daysPassed < nextRank.minDays) {
        return { 
            canPromote: false, 
            reason: `Tempo insuficiente. Necessário: ${nextRank.minDays} dias, atual: ${daysPassed} dias` 
        };
    }
    
    // Verificar cooldown de promoção (24h)
    const cooldown = cooldowns[userId];
    if (cooldown && cooldown.lastPromotion) {
        const hoursSinceLastPromotion = (Date.now() - cooldown.lastPromotion) / (1000 * 60 * 60);
        if (hoursSinceLastPromotion < 24) {
            return { 
                canPromote: false, 
                reason: `Aguarde ${Math.ceil(24 - hoursSinceLastPromotion)} horas para próxima promoção` 
            };
        }
    }
    
    return { canPromote: true, nextRank };
}

function canDemote(userId, currentRank) {
    const rank = getRankByName(currentRank);
    if (!rank) return { canDemote: false, reason: "Patente atual não encontrada" };
    
    if (rank.level === 1) {
        return { canDemote: false, reason: "Esta é a patente mínima. Use demissão para remover da corporação" };
    }
    
    // Verificar cooldown de rebaixamento (24h)
    const cooldown = cooldowns[userId];
    if (cooldown && cooldown.lastDemotion) {
        const hoursSinceLastDemotion = (Date.now() - cooldown.lastDemotion) / (1000 * 60 * 60);
        if (hoursSinceLastDemotion < 24) {
            return { 
                canDemote: false, 
                reason: `Aguarde ${Math.ceil(24 - hoursSinceLastDemotion)} horas para próximo rebaixamento` 
            };
        }
    }
    
    const previousRank = getRankByLevel(rank.level - 1);
    return { canDemote: true, previousRank };
}

function logAction(guild, action, officer, target, details) {
    if (!botConfig.logChannel) return;
    
    const logChannel = guild.channels.cache.get(botConfig.logChannel);
    if (!logChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 ${action}`)
        .setColor(details.color || '#0099ff')
        .addFields(
            { name: '👮 Oficial Responsável', value: `<@${officer.id}>`, inline: true },
            { name: '👤 Membro Afetado', value: `<@${target.id}>`, inline: true },
            { name: '📅 Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp();
    
    if (details.oldRank) embed.addFields({ name: '📉 Patente Anterior', value: details.oldRank, inline: true });
    if (details.newRank) embed.addFields({ name: '📈 Nova Patente', value: details.newRank, inline: true });
    if (details.reason) embed.addFields({ name: '📝 Motivo', value: details.reason, inline: false });
    
    logChannel.send({ embeds: [embed] });
}

// ============ COMANDOS SLASH ============
const commands = [
    new SlashCommandBuilder()
        .setName('configuracao')
        .setDescription('Configurar o sistema hierárquico')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    new SlashCommandBuilder()
        .setName('recrutar')
        .setDescription('Recrutar um cidadão para a corporação')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário a ser recrutado')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do recrutamento')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('promover')
        .setDescription('Promover um membro da corporação')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário a ser promovido')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da promoção')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('rebaixar')
        .setDescription('Rebaixar um membro da corporação')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário a ser rebaixado')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do rebaixamento')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('demitir')
        .setDescription('Demitir um membro da corporação')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário a ser demitido')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da demissão')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('hierarquia')
        .setDescription('Visualizar a hierarquia atual'),
    
    new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Ver perfil de um membro')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para ver o perfil')
                .setRequired(false))
];

// ============ EVENTOS DO BOT ============
client.once('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} está online!`);
    
    // Registrar comandos slash
    try {
        console.log('🔄 Registrando comandos slash...');
        await interaction.reply({
            content: `⚠️ **${targetUser.tag}** foi rebaixado!\n` +
                    `📉 **De:** ${currentRank.name}\n` +
                    `📈 **Para:** ${previousRank.name}\n` +
                    `📝 **Motivo:** ${reason}`,
            ephemeral: false
        });
        
    } catch (error) {
        await interaction.reply({ 
            content: '❌ Erro ao alterar os cargos do usuário.', 
            ephemeral: true 
        });
    }
}

async function handleFireCommand(interaction) {
    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo');
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    // Verificar permissões
    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) || 
                         botConfig.promoteRoles.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasPermission) {
        return await interaction.reply({ 
            content: '❌ Você não tem permissão para demitir membros.', 
            ephemeral: true 
        });
    }
    
    // Encontrar cargo atual
    const hierarchy = getCurrentHierarchy();
    const currentRole = member.roles.cache.find(role => 
        hierarchy.ranks.some(rank => rank.name === role.name)
    );
    
    if (!currentRole) {
        return await interaction.reply({ 
            content: '❌ Este usuário não faz parte da corporação.', 
            ephemeral: true 
        });
    }
    
    const currentRank = getRankByName(currentRole.name);
    
    try {
        // Remover cargo hierárquico
        await member.roles.remove(currentRole);
        
        // Adicionar cargo de cidadão se configurado
        if (botConfig.citizenRole) {
            const citizenRole = interaction.guild.roles.cache.get(botConfig.citizenRole);
            if (citizenRole) {
                await member.roles.add(citizenRole);
            }
        }
        
        // Remover do sistema
        delete userData[targetUser.id];
        delete cooldowns[targetUser.id];
        
        // Log da ação
        logAction(interaction.guild, 'DEMISSÃO', interaction.user, targetUser, {
            oldRank: currentRank.name,
            reason: reason,
            color: '#ff0000'
        });
        
        await interaction.reply({
            content: `🚫 **${targetUser.tag}** foi demitido da corporação!\n` +
                    `📉 **Cargo removido:** ${currentRank.name}\n` +
                    `📝 **Motivo:** ${reason}`,
            ephemeral: false
        });
        
    } catch (error) {
        await interaction.reply({ 
            content: '❌ Erro ao remover o cargo do usuário.', 
            ephemeral: true 
        });
    }
}

async function handleHierarchyCommand(interaction) {
    const hierarchy = getCurrentHierarchy();
    
    const embed = new EmbedBuilder()
        .setTitle(`🏛️ ${hierarchy.name}`)
        .setDescription('Estrutura hierárquica atual da corporação')
        .setColor('#0099ff')
        .setTimestamp();
    
    let hierarchyText = '';
    hierarchy.ranks.reverse().forEach((rank, index) => {
        const emoji = index === 0 ? '👑' : index === 1 ? '⭐' : index === 2 ? '🔸' : '▫️';
        hierarchyText += `${emoji} **${rank.name}** (Nível ${rank.level})\n`;
        hierarchyText += `   └ Tempo mínimo: ${rank.minDays} dias\n\n`;
    });
    
    embed.setDescription(hierarchyText);
    
    await interaction.reply({ embeds: [embed] });
}

async function handleProfileCommand(interaction) {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    // Verificar se faz parte da corporação
    const hierarchy = getCurrentHierarchy();
    const currentRole = member.roles.cache.find(role => 
        hierarchy.ranks.some(rank => rank.name === role.name)
    );
    
    if (!currentRole) {
        return await interaction.reply({ 
            content: '❌ Este usuário não faz parte da corporação.', 
            ephemeral: true 
        });
    }
    
    const currentRank = getRankByName(currentRole.name);
    const userData_user = userData[targetUser.id];
    
    const embed = new EmbedBuilder()
        .setTitle(`👤 Perfil de ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(currentRank.color)
        .addFields(
            { name: '🏛️ Hierarquia', value: hierarchy.name, inline: true },
            { name: '⭐ Patente Atual', value: currentRank.name, inline: true },
            { name: '📊 Nível', value: currentRank.level.toString(), inline: true }
        );
    
    if (userData_user) {
        const joinDate = new Date(userData_user.joinDate);
        const daysSinceJoin = Math.floor((Date.now() - userData_user.joinDate) / (1000 * 60 * 60 * 24));
        
        embed.addFields(
            { name: '📅 Data de Ingresso', value: `<t:${Math.floor(joinDate.getTime() / 1000)}:D>`, inline: true },
            { name: '⏱️ Tempo de Serviço', value: `${daysSinceJoin} dias`, inline: true }
        );
        
        // Verificar se pode ser promovido
        const promotionCheck = canPromote(targetUser.id, currentRank.name);
        if (promotionCheck.canPromote) {
            embed.addFields({ name: '📈 Status', value: '✅ Elegível para promoção', inline: false });
        } else {
            embed.addFields({ name: '📈 Status', value: `⏳ ${promotionCheck.reason}`, inline: false });
        }
    }
    
    await interaction.reply({ embeds: [embed] });
}

// ============ SISTEMA DE VERIFICAÇÃO ROBLOX (OPCIONAL) ============
async function checkRobloxPlaytime(userId) {
    if (!botConfig.robloxTimeEnabled) return true;
    
    // Esta função seria implementada com uma API do Roblox
    // Por enquanto, retorna true (aprovado)
    // Implementação exemplo com Bloxlink ou RoVer:
    /*
    try {
        const response = await fetch(`https://api.bloxlink.com/v1/user/${userId}`);
        const data = await response.json();
        
        if (data.robloxId) {
            // Verificar tempo de jogo via API do Roblox
            // Se tempo >= botConfig.minRobloxHours, retornar true
        }
        
        return false; // Não tem horas suficientes
    } catch (error) {
        return false; // Erro na verificação
    }
    */
    
    return true;
}

// ============ SISTEMA DE BACKUP (OPCIONAL) ============
function saveData() {
    // Em produção, você poderia salvar em um banco de dados
    // ou arquivo JSON para persistir os dados
    const data = {
        botConfig,
        userData,
        cooldowns
    };
    
    // Exemplo: fs.writeFileSync('backup.json', JSON.stringify(data, null, 2));
    console.log('💾 Dados salvos em memória');
}

function loadData() {
    // Em produção, carregar dados salvos
    // const data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));
    // botConfig = data.botConfig;
    // userData = data.userData;
    // cooldowns = data.cooldowns;
    console.log('📁 Dados carregados');
}

// Salvar dados a cada 5 minutos (opcional)
setInterval(saveData, 5 * 60 * 1000);

// ============ TRATAMENTO DE ERROS ============
client.on('error', error => {
    console.error('❌ Erro no cliente Discord:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Erro não tratado:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Exceção não capturada:', error);
    process.exit(1);
});

// ============ INICIALIZAÇÃO ============
// Carregar dados salvos (se houver)
loadData();

// Login do bot
client.login(process.env.DISCORD_TOKEN); client.application?.commands.set(commands);
        console.log('✅ Comandos registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        } else if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction);
        }
    } catch (error) {
        console.error('❌ Erro na interação:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocorreu um erro ao processar sua solicitação.', ephemeral: true });
        }
    }
});

// ============ HANDLERS ============
async function handleSlashCommand(interaction) {
    const { commandName } = interaction;
    
    switch (commandName) {
        case 'configuracao':
            await handleConfigCommand(interaction);
            break;
        case 'recrutar':
            await handleRecruitCommand(interaction);
            break;
        case 'promover':
            await handlePromoteCommand(interaction);
            break;
        case 'rebaixar':
            await handleDemoteCommand(interaction);
            break;
        case 'demitir':
            await handleFireCommand(interaction);
            break;
        case 'hierarquia':
            await handleHierarchyCommand(interaction);
            break;
        case 'perfil':
            await handleProfileCommand(interaction);
            break;
    }
}

async function handleConfigCommand(interaction) {
    const configMenu = new StringSelectMenuBuilder()
        .setCustomId('config_menu')
        .setPlaceholder('Selecione uma configuração')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('🏛️ Alterar Hierarquia')
                .setDescription('Alterar a hierarquia ativa do servidor')
                .setValue('change_hierarchy'),
            new StringSelectMenuOptionBuilder()
                .setLabel('📝 Canal de Logs')
                .setDescription('Definir canal para registros')
                .setValue('set_log_channel'),
            new StringSelectMenuOptionBuilder()
                .setLabel('👮 Cargos de Recrutamento')
                .setDescription('Definir quem pode recrutar')
                .setValue('set_recruit_roles'),
            new StringSelectMenuOptionBuilder()
                .setLabel('⬆️ Cargos de Promoção')
                .setDescription('Definir quem pode promover')
                .setValue('set_promote_roles'),
            new StringSelectMenuOptionBuilder()
                .setLabel('👤 Cargo Cidadão')
                .setDescription('Definir cargo padrão dos cidadãos')
                .setValue('set_citizen_role'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎮 Sistema Roblox')
                .setDescription('Configurar integração com Roblox')
                .setValue('roblox_config')
        );
    
    const row = new ActionRowBuilder().addComponents(configMenu);
    
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Configurações do Sistema Hierárquico')
        .setDescription('Selecione uma opção para configurar:')
        .addFields(
            { name: '🏛️ Hierarquia Atual', value: getCurrentHierarchy().name, inline: true },
            { name: '📝 Canal de Logs', value: botConfig.logChannel ? `<#${botConfig.logChannel}>` : 'Não configurado', inline: true },
            { name: '🎮 Roblox', value: botConfig.robloxTimeEnabled ? 'Ativado' : 'Desativado', inline: true }
        )
        .setColor('#0099ff');
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleSelectMenu(interaction) {
    const { customId, values } = interaction;
    
    if (customId === 'config_menu') {
        await handleConfigMenuSelection(interaction, values[0]);
    } else if (customId === 'hierarchy_menu') {
        await handleHierarchySelection(interaction, values[0]);
    }
}

async function handleConfigMenuSelection(interaction, selection) {
    switch (selection) {
        case 'change_hierarchy':
            const hierarchyMenu = new StringSelectMenuBuilder()
                .setCustomId('hierarchy_menu')
                .setPlaceholder('Selecione uma hierarquia')
                .addOptions(
                    Object.entries(hierarchies).map(([key, hierarchy]) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(hierarchy.name)
                            .setValue(key)
                            .setDefault(key === botConfig.activeHierarchy)
                    )
                );
            
            const row = new ActionRowBuilder().addComponents(hierarchyMenu);
            await interaction.update({
                content: '🏛️ **Selecione a hierarquia desejada:**',
                components: [row],
                embeds: []
            });
            break;
            
        case 'set_log_channel':
            await interaction.update({
                content: `📝 **Canal de logs atual:** ${botConfig.logChannel ? `<#${botConfig.logChannel}>` : 'Não configurado'}\n\n` +
                        '❗ **Para alterar:** Use o comando `/configuracao` novamente e mencione o canal desejado.',
                components: [],
                embeds: []
            });
            break;
            
        case 'roblox_config':
            botConfig.robloxTimeEnabled = !botConfig.robloxTimeEnabled;
            await interaction.update({
                content: `🎮 **Sistema Roblox:** ${botConfig.robloxTimeEnabled ? '✅ Ativado' : '❌ Desativado'}`,
                components: [],
                embeds: []
            });
            break;
            
        default:
            await interaction.update({
                content: '⚠️ Esta configuração ainda não foi implementada.',
                components: [],
                embeds: []
            });
    }
}

async function handleHierarchySelection(interaction, hierarchyKey) {
    botConfig.activeHierarchy = hierarchyKey;
    const hierarchy = hierarchies[hierarchyKey];
    
    await interaction.update({
        content: `✅ **Hierarquia alterada para:** ${hierarchy.name}`,
        components: [],
        embeds: []
    });
}

async function handleRecruitCommand(interaction) {
    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') || 'Não informado';
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    // Verificar permissões
    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) || 
                         botConfig.recruitRoles.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasPermission) {
        return await interaction.reply({ 
            content: '❌ Você não tem permissão para recrutar membros.', 
            ephemeral: true 
        });
    }
    
    // Verificar se já está na corporação
    const hierarchy = getCurrentHierarchy();
    const hasHierarchyRole = hierarchy.ranks.some(rank => 
        member.roles.cache.find(role => role.name === rank.name)
    );
    
    if (hasHierarchyRole) {
        return await interaction.reply({ 
            content: '❌ Este usuário já faz parte da corporação.', 
            ephemeral: true 
        });
    }
    
    // Recrutar (dar o primeiro cargo da hierarquia)
    const initialRank = hierarchy.ranks[0];
    let initialRole = interaction.guild.roles.cache.find(role => role.name === initialRank.name);
    
    if (!initialRole) {
        // Criar o cargo se não existir
        try {
            initialRole = await interaction.guild.roles.create({
                name: initialRank.name,
                color: initialRank.color,
                reason: `Cargo criado pelo sistema hierárquico - ${hierarchy.name}`
            });
        } catch (error) {
            return await interaction.reply({ 
                content: '❌ Erro ao criar o cargo necessário.', 
                ephemeral: true 
            });
        }
    }
    
    try {
        await member.roles.add(initialRole);
        
        // Registrar usuário no sistema
        userData[targetUser.id] = {
            joinDate: Date.now(),
            lastAction: Date.now(),
            currentRank: initialRank.name
        };
        
        // Log da ação
        logAction(interaction.guild, 'RECRUTAMENTO', interaction.user, targetUser, {
            newRank: initialRank.name,
            reason: reason,
            color: '#00ff00'
        });
        
        await interaction.reply({
            content: `✅ **${targetUser.tag}** foi recrutado com sucesso!\n` +
                    `📈 **Patente inicial:** ${initialRank.name}\n` +
                    `📝 **Motivo:** ${reason}`,
            ephemeral: false
        });
        
    } catch (error) {
        await interaction.reply({ 
            content: '❌ Erro ao adicionar o cargo ao usuário.', 
            ephemeral: true 
        });
    }
}

async function handlePromoteCommand(interaction) {
    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') || 'Não informado';
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    // Verificar permissões
    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) || 
                         botConfig.promoteRoles.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasPermission) {
        return await interaction.reply({ 
            content: '❌ Você não tem permissão para promover membros.', 
            ephemeral: true 
        });
    }
    
    // Encontrar cargo atual
    const hierarchy = getCurrentHierarchy();
    const currentRole = member.roles.cache.find(role => 
        hierarchy.ranks.some(rank => rank.name === role.name)
    );
    
    if (!currentRole) {
        return await interaction.reply({ 
            content: '❌ Este usuário não faz parte da corporação.', 
            ephemeral: true 
        });
    }
    
    const currentRank = getRankByName(currentRole.name);
    const promotionCheck = canPromote(targetUser.id, currentRank.name);
    
    if (!promotionCheck.canPromote) {
        return await interaction.reply({ 
            content: `❌ ${promotionCheck.reason}`, 
            ephemeral: true 
        });
    }
    
    // Promover
    const nextRank = promotionCheck.nextRank;
    let nextRole = interaction.guild.roles.cache.find(role => role.name === nextRank.name);
    
    if (!nextRole) {
        try {
            nextRole = await interaction.guild.roles.create({
                name: nextRank.name,
                color: nextRank.color,
                reason: `Cargo criado pelo sistema hierárquico - ${hierarchy.name}`
            });
        } catch (error) {
            return await interaction.reply({ 
                content: '❌ Erro ao criar o cargo necessário.', 
                ephemeral: true 
            });
        }
    }
    
    try {
        await member.roles.remove(currentRole);
        await member.roles.add(nextRole);
        
        // Atualizar dados do usuário
        if (userData[targetUser.id]) {
            userData[targetUser.id].currentRank = nextRank.name;
            userData[targetUser.id].lastAction = Date.now();
        }
        
        // Registrar cooldown
        if (!cooldowns[targetUser.id]) cooldowns[targetUser.id] = {};
        cooldowns[targetUser.id].lastPromotion = Date.now();
        
        // Log da ação
        logAction(interaction.guild, 'PROMOÇÃO', interaction.user, targetUser, {
            oldRank: currentRank.name,
            newRank: nextRank.name,
            reason: reason,
            color: '#00ff00'
        });
        
        await interaction.reply({
            content: `✅ **${targetUser.tag}** foi promovido!\n` +
                    `📉 **De:** ${currentRank.name}\n` +
                    `📈 **Para:** ${nextRank.name}\n` +
                    `📝 **Motivo:** ${reason}`,
            ephemeral: false
        });
        
    } catch (error) {
        await interaction.reply({ 
            content: '❌ Erro ao alterar os cargos do usuário.', 
            ephemeral: true 
        });
    }
}

async function handleDemoteCommand(interaction) {
    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo');
    const member = await interaction.guild.members.fetch(targetUser.id);
    
    // Verificar permissões
    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) || 
                         botConfig.promoteRoles.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasPermission) {
        return await interaction.reply({ 
            content: '❌ Você não tem permissão para rebaixar membros.', 
            ephemeral: true 
        });
    }
    
    // Encontrar cargo atual
    const hierarchy = getCurrentHierarchy();
    const currentRole = member.roles.cache.find(role => 
        hierarchy.ranks.some(rank => rank.name === role.name)
    );
    
    if (!currentRole) {
        return await interaction.reply({ 
            content: '❌ Este usuário não faz parte da corporação.', 
            ephemeral: true 
        });
    }
    
    const currentRank = getRankByName(currentRole.name);
    const demotionCheck = canDemote(targetUser.id, currentRank.name);
    
    if (!demotionCheck.canDemote) {
        return await interaction.reply({ 
            content: `❌ ${demotionCheck.reason}`, 
            ephemeral: true 
        });
    }
    
    // Rebaixar
    const previousRank = demotionCheck.previousRank;
    let previousRole = interaction.guild.roles.cache.find(role => role.name === previousRank.name);
    
    if (!previousRole) {
        try {
            previousRole = await interaction.guild.roles.create({
                name: previousRank.name,
                color: previousRank.color,
                reason: `Cargo criado pelo sistema hierárquico - ${hierarchy.name}`
            });
        } catch (error) {
            return await interaction.reply({ 
                content: '❌ Erro ao criar o cargo necessário.', 
                ephemeral: true 
            });
        }
    }
    
    try {
        await member.roles.remove(currentRole);
        await member.roles.add(previousRole);
        
        // Atualizar dados do usuário
        if (userData[targetUser.id]) {
            userData[targetUser.id].currentRank = previousRank.name;
            userData[targetUser.id].lastAction = Date.now();
        }
        
        // Registrar cooldown
        if (!cooldowns[targetUser.id]) cooldowns[targetUser.id] = {};
        cooldowns[targetUser.id].lastDemotion = Date.now();
        
        // Log da ação
        logAction(interaction.guild, 'REBAIXAMENTO', interaction.user, targetUser, {
            oldRank: currentRank.name,
            newRank: previousRank.name,
            reason: reason,
            color: '#ff8800'
        });
        
        await
