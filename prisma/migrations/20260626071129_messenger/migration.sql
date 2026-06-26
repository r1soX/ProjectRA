-- CreateTable
CREATE TABLE "ChannelMember" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "userId"),
    CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
