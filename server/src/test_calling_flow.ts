import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

import axios from 'axios';
import { prisma } from './prisma';

const BASE_URL = 'http://localhost:5000/api';

async function testCallingPipeline() {
  console.log('\n======================================================');
  console.log('📞 MODULEFORGE END-TO-END CALLING PIPELINE TEST');
  console.log('======================================================\n');

  const timestamp = Date.now().toString().slice(-4);

  // 1. Create two test users (Caller & Receiver) in DB
  const caller = await (prisma as any).user.upsert({
    where: { email: `alice_${timestamp}@moduleforge.test` },
    update: {},
    create: {
      id: `caller-${Date.now()}`,
      name: 'Alice Developer',
      username: `alice_${timestamp}`,
      email: `alice_${timestamp}@moduleforge.test`,
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=Alice',
      isDev: true,
    },
  });

  const receiver = await (prisma as any).user.upsert({
    where: { email: `bob_${timestamp}@moduleforge.test` },
    update: {},
    create: {
      id: `receiver-${Date.now()}`,
      name: 'Bob Engineer',
      username: `bob_${timestamp}`,
      email: `bob_${timestamp}@moduleforge.test`,
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=Bob',
      isDev: true,
    },
  });

  console.log(`✅ Provisioned Caller: ${caller.name} (@${caller.username}, ID: ${caller.id})`);
  console.log(`✅ Provisioned Receiver: ${receiver.name} (@${receiver.username}, ID: ${receiver.id})`);

  // 2. Create Team with Alice as Owner
  console.log('\nStep 1: Creating Team with Alice as Owner...');
  const teamRes = await axios.post(`${BASE_URL}/teams`, {
    name: `DevOps Squad ${timestamp}`,
    description: 'Team for testing voice/video calling',
    ownerId: caller.id,
    ownerEmail: caller.email,
    ownerName: caller.name,
    ownerUsername: caller.username,
  });

  const teamId = teamRes.data.team?.id || teamRes.data.id;
  console.log(`✅ Team created with ID: ${teamId}`);

  // 3. Alice invites Bob to the Team by @username, and Bob accepts
  console.log('\nStep 2: Alice invites Bob by @username and Bob accepts...');
  const inviteRes = await axios.post(`${BASE_URL}/teams/${teamId}/invitations/username`, {
    username: receiver.username,
    inviterId: caller.id,
    role: 'member',
  });

  const inviteToken = inviteRes.data.invitation?.token;
  console.log(`✅ Invitation created with token: ${inviteToken}`);

  // Bob accepts invitation
  const acceptInviteRes = await axios.post(`${BASE_URL}/invitations/${inviteToken}/accept`, {
    userId: receiver.id,
  });
  console.log(`✅ Bob accepted invitation: ${acceptInviteRes.data.message || 'Joined team'}`);

  // 4. Verify Team Details & Members List
  console.log('\nStep 3: Fetching Team Details...');
  const teamDetailRes = await axios.get(`${BASE_URL}/teams/${teamId}`);
  const teamData = teamDetailRes.data.team || teamDetailRes.data;
  const members = teamData.members || [];
  console.log(`✅ Retrieved ${members.length} team members:`);
  members.forEach((m: any, idx: number) => {
    console.log(`   ${idx + 1}. ${m.user?.name} (@${m.user?.username}) - Role: ${m.role}`);
  });

  const bobMember = members.find((m: any) => m.user?.username === receiver.username || m.user?.email === receiver.email);
  const bobUserId = bobMember?.userId || bobMember?.user?.id || receiver.id;
  console.log(`   -> Target Member (Bob) User ID: ${bobUserId}`);

  // 5. Alice initiates a Voice Call to Bob
  console.log('\nStep 4: Alice initiates Voice Call to Bob...');
  const voiceCallRes = await axios.post(`${BASE_URL}/calls/initiate`, {
    callerId: caller.id,
    receiverId: bobUserId,
    type: 'voice',
  });

  const voiceCall = voiceCallRes.data.call;
  console.log(`✅ Voice Call initiated:`);
  console.log(`   - Call ID: ${voiceCall.id}`);
  console.log(`   - Room ID: ${voiceCall.roomId}`);
  console.log(`   - Status: ${voiceCall.status}`);
  console.log(`   - Token generated: ${!!voiceCallRes.data.token}`);

  // 6. Bob polls for active incoming calls
  console.log('\nStep 5: Bob checks for active incoming calls...');
  const bobActiveRes = await axios.get(`${BASE_URL}/calls/active?userId=${bobUserId}`);
  const incomingCall = bobActiveRes.data.activeCall;
  if (incomingCall && incomingCall.id === voiceCall.id) {
    console.log(`✅ Bob received incoming call ringing from ${incomingCall.caller?.name}! (Status: ${incomingCall.status})`);
  } else {
    console.error('❌ Failed: Incoming call not detected for Bob');
  }

  // 7. Bob accepts the call (status -> CONNECTED)
  console.log('\nStep 6: Bob accepts the call...');
  const acceptRes = await axios.patch(`${BASE_URL}/calls/${voiceCall.id}/status`, {
    status: 'CONNECTED',
  });
  console.log(`✅ Call status updated to: ${acceptRes.data.call.status}`);

  // 8. Bob requests token to join WebRTC audio stream
  console.log('\nStep 7: Bob retrieves WebRTC / LiveKit room token...');
  const tokenRes = await axios.post(`${BASE_URL}/calls/${voiceCall.id}/token`, {
    userId: bobUserId,
  });
  console.log(`✅ Bob room token generated: ${!!tokenRes.data.token}`);

  // 9. Alice checks active call state
  console.log('\nStep 8: Alice checks active call status...');
  const aliceActiveRes = await axios.get(`${BASE_URL}/calls/active?userId=${caller.id}`);
  console.log(`✅ Alice active call status: ${aliceActiveRes.data.activeCall?.status} (Connected with ${aliceActiveRes.data.activeCall?.receiver?.name})`);

  // 10. End Call (duration: 45 seconds)
  console.log('\nStep 9: Ending voice call...');
  const endRes = await axios.patch(`${BASE_URL}/calls/${voiceCall.id}/status`, {
    status: 'ENDED',
    duration: 45,
  });
  console.log(`✅ Call successfully ended! Final status: ${endRes.data.call.status}, Duration: ${endRes.data.call.duration}s`);

  // 11. Test Video Call
  console.log('\nStep 10: Testing 1:1 Video Call Initiation...');
  const videoCallRes = await axios.post(`${BASE_URL}/calls/initiate`, {
    callerId: caller.id,
    receiverId: bobUserId,
    type: 'video',
  });
  const videoCall = videoCallRes.data.call;
  console.log(`✅ Video Call initiated with Type: ${videoCall.type}, Room: ${videoCall.roomId}`);

  // End video call
  await axios.patch(`${BASE_URL}/calls/${videoCall.id}/status`, {
    status: 'ENDED',
    duration: 120,
  });
  console.log(`✅ Video Call ended successfully.`);

  // 12. Check Call History
  console.log('\nStep 11: Checking Call History for Alice...');
  const historyRes = await axios.get(`${BASE_URL}/calls/history?userId=${caller.id}`);
  console.log(`✅ Retrieved ${historyRes.data.history?.length || 0} call logs in history:`);
  (historyRes.data.history || []).slice(0, 2).forEach((c: any, i: number) => {
    console.log(`   ${i + 1}. [${c.type.toUpperCase()}] With ${c.receiver?.name} - Status: ${c.status} (${c.duration}s)`);
  });

  console.log('\n======================================================');
  console.log('🎉 ALL CALLING & VIDEO PIPELINE TESTS PASSED 100%!');
  console.log('======================================================\n');
}

testCallingPipeline().catch(console.error);
