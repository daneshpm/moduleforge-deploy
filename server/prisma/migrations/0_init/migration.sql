-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "avatarUrl" TEXT,
    "isDev" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeUserId" TEXT,
    "inviteeEmail" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedTeamId" TEXT,
    "relatedInvitationId" TEXT,
    "relatedMeetingId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "technologies" TEXT DEFAULT '[]',
    "sourceType" TEXT NOT NULL,
    "repositoryType" TEXT DEFAULT 'upload',
    "repositoryUrl" TEXT,
    "repositoryPath" TEXT,
    "defaultBranch" TEXT DEFAULT 'main',
    "githubUrl" TEXT,
    "githubOwner" TEXT,
    "githubRepo" TEXT,
    "githubBranch" TEXT DEFAULT 'main',
    "githubCurrentCommit" TEXT,
    "githubLatestCommit" TEXT,
    "githubLastSyncedAt" TIMESTAMP(3),
    "githubSyncStatus" TEXT DEFAULT 'synced',
    "githubWebhookId" TEXT,
    "frontendCommand" TEXT DEFAULT 'npm run dev',
    "backendCommand" TEXT DEFAULT '',
    "frontendPort" INTEGER DEFAULT 5173,
    "backendPort" INTEGER DEFAULT 5000,
    "frontendUrl" TEXT DEFAULT 'http://localhost:5173',
    "backendUrl" TEXT DEFAULT 'http://localhost:5000',
    "workingDir" TEXT DEFAULT '.',
    "envVars" TEXT DEFAULT '[]',
    "zipStoragePath" TEXT,
    "moduleJson" TEXT,
    "contractVersion" TEXT,
    "dependsOn" TEXT,
    "requiredEnv" TEXT,
    "hostServices" TEXT,
    "eventsPublished" TEXT,
    "eventsConsumed" TEXT,
    "permissions" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "deployedUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleSync" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "author" TEXT,
    "status" TEXT NOT NULL DEFAULT 'synced',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleVersion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "moduleJson" TEXT,
    "contractVersion" TEXT,
    "dependsOn" TEXT,
    "requiredEnv" TEXT,
    "hostServices" TEXT,
    "eventsPublished" TEXT,
    "eventsConsumed" TEXT,
    "permissions" TEXT,
    "zipStoragePath" TEXT,
    "changelog" TEXT,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "teamId" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'individual',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "joinCode" TEXT,
    "canvasConfig" TEXT,
    "gitRepositoryUrl" TEXT,
    "gitOwner" TEXT,
    "gitRepo" TEXT,
    "gitBranch" TEXT DEFAULT 'main',
    "currentCommitSha" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "externalId" TEXT,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'developer',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inviteToken" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectModule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleVersion" TEXT NOT NULL,
    "installedContractId" TEXT,
    "pinnedRange" TEXT,
    "installedAt" TIMESTAMP(3),
    "installedHash" TEXT,
    "installedFiles" TEXT,
    "xPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "configuration" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "repositoryType" TEXT DEFAULT 'moduleforge',
    "repositoryPath" TEXT,
    "currentBranch" TEXT DEFAULT 'main',
    "gitStatus" TEXT DEFAULT 'up_to_date',
    "githubRepository" TEXT,
    "githubBranch" TEXT DEFAULT 'main',
    "currentCommitSha" TEXT,
    "lastCommitMessage" TEXT,
    "lastCommitAuthor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "deploymentUrl" TEXT,
    "deploymentStatus" TEXT DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleCommit" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "projectModuleId" TEXT,
    "commitSha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "changedFiles" TEXT DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleDeployment" (
    "id" TEXT NOT NULL,
    "projectModuleId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "author" TEXT,
    "deploymentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "buildLogs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "moduleName" TEXT,
    "action" TEXT NOT NULL,
    "actorName" TEXT,
    "description" TEXT NOT NULL,
    "commitSha" TEXT,
    "status" TEXT NOT NULL DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "zipFileName" TEXT NOT NULL,
    "zipPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" TEXT DEFAULT '[]',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectChat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectChatParticipant" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" TEXT DEFAULT '[]',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'voice',
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT,
    "chatId" TEXT,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CALLING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "teamId" TEXT,
    "projectId" TEXT,
    "channelId" TEXT,
    "createdById" TEXT NOT NULL,
    "isScreenSharing" BOOLEAN NOT NULL DEFAULT false,
    "screenShareUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isVideoOff" BOOLEAN NOT NULL DEFAULT false,
    "isHandRaised" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'online',
    "customStatus" TEXT,
    "currentActivity" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_token_key" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvitation_inviterId_idx" ON "TeamInvitation"("inviterId");

-- CreateIndex
CREATE INDEX "TeamInvitation_inviteeUserId_idx" ON "TeamInvitation"("inviteeUserId");

-- CreateIndex
CREATE INDEX "TeamInvitation_inviteeEmail_idx" ON "TeamInvitation"("inviteeEmail");

-- CreateIndex
CREATE INDEX "TeamInvitation_token_idx" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX "TeamInvitation_status_idx" ON "TeamInvitation"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_relatedTeamId_idx" ON "Notification"("relatedTeamId");

-- CreateIndex
CREATE INDEX "Notification_relatedInvitationId_idx" ON "Notification"("relatedInvitationId");

-- CreateIndex
CREATE INDEX "Notification_relatedMeetingId_idx" ON "Notification"("relatedMeetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Module_slug_key" ON "Module"("slug");

-- CreateIndex
CREATE INDEX "Module_slug_idx" ON "Module"("slug");

-- CreateIndex
CREATE INDEX "Module_categoryName_idx" ON "Module"("categoryName");

-- CreateIndex
CREATE INDEX "Module_author_idx" ON "Module"("author");

-- CreateIndex
CREATE INDEX "ModuleSync_moduleId_idx" ON "ModuleSync"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleSync_syncedAt_idx" ON "ModuleSync"("syncedAt");

-- CreateIndex
CREATE INDEX "ModuleVersion_moduleId_idx" ON "ModuleVersion"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleVersion_moduleId_version_key" ON "ModuleVersion"("moduleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Project_joinCode_key" ON "Project"("joinCode");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_teamId_idx" ON "Project"("teamId");

-- CreateIndex
CREATE INDEX "Project_joinCode_idx" ON "Project"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_projectId_key" ON "Repository"("projectId");

-- CreateIndex
CREATE INDEX "Repository_projectId_idx" ON "Repository"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_inviteToken_key" ON "ProjectMember"("inviteToken");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_email_idx" ON "ProjectMember"("email");

-- CreateIndex
CREATE INDEX "ProjectMember_inviteToken_idx" ON "ProjectMember"("inviteToken");

-- CreateIndex
CREATE INDEX "ProjectModule_projectId_idx" ON "ProjectModule"("projectId");

-- CreateIndex
CREATE INDEX "ProjectModule_moduleId_idx" ON "ProjectModule"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleCommit_moduleId_idx" ON "ModuleCommit"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleCommit_projectModuleId_idx" ON "ModuleCommit"("projectModuleId");

-- CreateIndex
CREATE INDEX "ModuleCommit_createdAt_idx" ON "ModuleCommit"("createdAt");

-- CreateIndex
CREATE INDEX "ModuleDeployment_projectModuleId_idx" ON "ModuleDeployment"("projectModuleId");

-- CreateIndex
CREATE INDEX "ModuleDeployment_createdAt_idx" ON "ModuleDeployment"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivity_projectId_idx" ON "ProjectActivity"("projectId");

-- CreateIndex
CREATE INDEX "ProjectActivity_createdAt_idx" ON "ProjectActivity"("createdAt");

-- CreateIndex
CREATE INDEX "Channel_teamId_idx" ON "Channel"("teamId");

-- CreateIndex
CREATE INDEX "Channel_projectId_idx" ON "Channel"("projectId");

-- CreateIndex
CREATE INDEX "Channel_type_idx" ON "Channel"("type");

-- CreateIndex
CREATE INDEX "ChannelMessage_channelId_idx" ON "ChannelMessage"("channelId");

-- CreateIndex
CREATE INDEX "ChannelMessage_senderId_idx" ON "ChannelMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChannelMessage_createdAt_idx" ON "ChannelMessage"("createdAt");

-- CreateIndex
CREATE INDEX "DirectChatParticipant_chatId_idx" ON "DirectChatParticipant"("chatId");

-- CreateIndex
CREATE INDEX "DirectChatParticipant_userId_idx" ON "DirectChatParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectChatParticipant_chatId_userId_key" ON "DirectChatParticipant"("chatId", "userId");

-- CreateIndex
CREATE INDEX "DirectMessage_chatId_idx" ON "DirectMessage"("chatId");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");

-- CreateIndex
CREATE INDEX "DirectMessage_createdAt_idx" ON "DirectMessage"("createdAt");

-- CreateIndex
CREATE INDEX "CallSession_callerId_idx" ON "CallSession"("callerId");

-- CreateIndex
CREATE INDEX "CallSession_receiverId_idx" ON "CallSession"("receiverId");

-- CreateIndex
CREATE INDEX "CallSession_roomId_idx" ON "CallSession"("roomId");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- CreateIndex
CREATE INDEX "CallSession_createdAt_idx" ON "CallSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_roomId_key" ON "Meeting"("roomId");

-- CreateIndex
CREATE INDEX "Meeting_teamId_idx" ON "Meeting"("teamId");

-- CreateIndex
CREATE INDEX "Meeting_projectId_idx" ON "Meeting"("projectId");

-- CreateIndex
CREATE INDEX "Meeting_channelId_idx" ON "Meeting"("channelId");

-- CreateIndex
CREATE INDEX "Meeting_roomId_idx" ON "Meeting"("roomId");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MeetingMessage_meetingId_idx" ON "MeetingMessage"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingMessage_senderId_idx" ON "MeetingMessage"("senderId");

-- CreateIndex
CREATE INDEX "MeetingMessage_createdAt_idx" ON "MeetingMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_userId_key" ON "UserPresence"("userId");

-- CreateIndex
CREATE INDEX "UserPresence_userId_idx" ON "UserPresence"("userId");

-- CreateIndex
CREATE INDEX "UserPresence_status_idx" ON "UserPresence"("status");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedTeamId_fkey" FOREIGN KEY ("relatedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedInvitationId_fkey" FOREIGN KEY ("relatedInvitationId") REFERENCES "TeamInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedMeetingId_fkey" FOREIGN KEY ("relatedMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_categoryName_fkey" FOREIGN KEY ("categoryName") REFERENCES "Category"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleSync" ADD CONSTRAINT "ModuleSync_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleVersion" ADD CONSTRAINT "ModuleVersion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectModule" ADD CONSTRAINT "ProjectModule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectModule" ADD CONSTRAINT "ProjectModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCommit" ADD CONSTRAINT "ModuleCommit_projectModuleId_fkey" FOREIGN KEY ("projectModuleId") REFERENCES "ProjectModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleDeployment" ADD CONSTRAINT "ModuleDeployment_projectModuleId_fkey" FOREIGN KEY ("projectModuleId") REFERENCES "ProjectModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedExport" ADD CONSTRAINT "GeneratedExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatParticipant" ADD CONSTRAINT "DirectChatParticipant_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectChatParticipant" ADD CONSTRAINT "DirectChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

