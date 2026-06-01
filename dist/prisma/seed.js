"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto = __importStar(require("node:crypto"));
const prisma = new client_1.PrismaClient();
const passwordPlain = 'password123';
const addDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
};
const receiptHash = (userId, electionId) => crypto.createHash('sha256').update(`${userId}:${electionId}`).digest('hex');
async function upsertUser(passwordHash, user) {
    const data = {
        ...user,
        passwordHash,
        role: user.role ?? client_1.Role.VOTER,
        isVerified: user.isVerified ?? true,
        isActive: user.isActive ?? true,
        isOverseas: user.isOverseas ?? false,
    };
    const existing = await prisma.user.findFirst({
        where: {
            OR: [{ email: user.email }, { phone: user.phone }, { cnic: user.cnic }],
        },
    });
    return existing
        ? prisma.user.update({ where: { id: existing.id }, data })
        : prisma.user.create({ data });
}
async function findOrCreateElection(data) {
    const existing = await prisma.election.findFirst({ where: { title: data.title } });
    return existing ? prisma.election.update({ where: { id: existing.id }, data }) : prisma.election.create({ data });
}
async function main() {
    console.log('--- Seeding iBallot database ---');
    const passwordHash = await bcryptjs_1.default.hash(passwordPlain, 10);
    const punjab = await prisma.province.upsert({ where: { name: 'Punjab' }, update: { capital: 'Lahore', assemblyPrefix: 'PP' }, create: { name: 'Punjab', capital: 'Lahore', assemblyPrefix: 'PP' } });
    const sindh = await prisma.province.upsert({ where: { name: 'Sindh' }, update: { capital: 'Karachi', assemblyPrefix: 'PS' }, create: { name: 'Sindh', capital: 'Karachi', assemblyPrefix: 'PS' } });
    const lahore = await prisma.city.upsert({ where: { name_provinceId: { name: 'Lahore', provinceId: punjab.id } }, update: {}, create: { name: 'Lahore', provinceId: punjab.id } });
    const rawalpindi = await prisma.city.upsert({ where: { name_provinceId: { name: 'Rawalpindi', provinceId: punjab.id } }, update: {}, create: { name: 'Rawalpindi', provinceId: punjab.id } });
    const karachi = await prisma.city.upsert({ where: { name_provinceId: { name: 'Karachi', provinceId: sindh.id } }, update: {}, create: { name: 'Karachi', provinceId: sindh.id } });
    const lb47 = await prisma.constituency.upsert({ where: { code: 'LB-47' }, update: { name: 'District 47', type: 'LOCAL', cityId: rawalpindi.id }, create: { code: 'LB-47', name: 'District 47', type: 'LOCAL', cityId: rawalpindi.id } });
    const na120 = await prisma.constituency.upsert({ where: { code: 'NA-120' }, update: { name: 'Lahore-III', type: 'NATIONAL_ASSEMBLY', cityId: lahore.id }, create: { code: 'NA-120', name: 'Lahore-III', type: 'NATIONAL_ASSEMBLY', cityId: lahore.id } });
    const na121 = await prisma.constituency.upsert({ where: { code: 'NA-121' }, update: { name: 'Lahore-IV', type: 'NATIONAL_ASSEMBLY', cityId: lahore.id }, create: { code: 'NA-121', name: 'Lahore-IV', type: 'NATIONAL_ASSEMBLY', cityId: lahore.id } });
    const ps101 = await prisma.constituency.upsert({ where: { code: 'PS-101' }, update: { name: 'Karachi South-I', type: 'PROVINCIAL_ASSEMBLY', cityId: karachi.id }, create: { code: 'PS-101', name: 'Karachi South-I', type: 'PROVINCIAL_ASSEMBLY', cityId: karachi.id } });
    const pp149 = await prisma.constituency.upsert({ where: { code: 'PP-149' }, update: { name: 'Lahore-X', type: 'PROVINCIAL_ASSEMBLY', cityId: lahore.id }, create: { code: 'PP-149', name: 'Lahore-X', type: 'PROVINCIAL_ASSEMBLY', cityId: lahore.id } });
    console.log('Seeding Parties...');
    const parties = {
        pti: await prisma.party.upsert({ where: { name: 'Pakistan Tehreek-e-Insaf' }, update: {}, create: { name: 'Pakistan Tehreek-e-Insaf', abbreviation: 'PTI' } }),
        pmln: await prisma.party.upsert({ where: { name: 'Pakistan Muslim League (N)' }, update: {}, create: { name: 'Pakistan Muslim League (N)', abbreviation: 'PML-N' } }),
        ppp: await prisma.party.upsert({ where: { name: 'Pakistan Peoples Party' }, update: {}, create: { name: 'Pakistan Peoples Party', abbreviation: 'PPP' } }),
        ji: await prisma.party.upsert({ where: { name: 'Jamaat-e-Islami' }, update: {}, create: { name: 'Jamaat-e-Islami', abbreviation: 'JI' } }),
        independent: await prisma.party.upsert({ where: { name: 'Independent Candidate' }, update: {}, create: { name: 'Independent Candidate', abbreviation: 'IND' } }),
    };
    const admin = await upsertUser(passwordHash, { email: 'admin@iballot.com', phone: '+923000000000', cnic: '42101-0000000-1', role: client_1.Role.SUPER_ADMIN, fatherName: 'iBallot Super Admin', province: 'Punjab', city: 'Lahore', addressDetails: 'iBallot Head Office, Lahore' });
    const lahoreAdmin = await upsertUser(passwordHash, { email: 'lahore.admin@iballot.com', phone: '+923000000001', cnic: '42101-0000000-2', role: client_1.Role.ADMIN, fatherName: 'Lahore Election Admin', province: 'Punjab', city: 'Lahore', constituencyId: na120.id });
    const karachiAdmin = await upsertUser(passwordHash, { email: 'karachi.admin@iballot.com', phone: '+923000000002', cnic: '42101-0000000-3', role: client_1.Role.ADMIN, fatherName: 'Karachi Election Admin', province: 'Sindh', city: 'Karachi', constituencyId: ps101.id });
    const voters = await Promise.all([
        upsertUser(passwordHash, { email: 'voter@test.com', phone: '+923001111111', cnic: '35202-1111111-1', fatherName: 'Ahsan Raza', province: 'Punjab', city: 'Lahore', constituencyId: na120.id, addressDetails: 'Model Town, Lahore' }),
        upsertUser(passwordHash, { email: 'fatima.voter@iballot.com', phone: '+923001111112', cnic: '35202-1111111-2', fatherName: 'Fatima Noor', province: 'Punjab', city: 'Lahore', constituencyId: na120.id, addressDetails: 'Johar Town, Lahore' }),
        upsertUser(passwordHash, { email: 'hamza.voter@iballot.com', phone: '+923001111113', cnic: '35202-1111111-3', fatherName: 'Hamza Tariq', province: 'Punjab', city: 'Lahore', constituencyId: na121.id }),
        upsertUser(passwordHash, { email: 'sana.voter@iballot.com', phone: '+923001111114', cnic: '35202-1111111-4', fatherName: 'Sana Malik', province: 'Punjab', city: 'Rawalpindi', constituencyId: lb47.id }),
        upsertUser(passwordHash, { email: 'umer.voter@iballot.com', phone: '+923001111115', cnic: '35202-1111111-5', fatherName: 'Umer Farooq', province: 'Sindh', city: 'Karachi', constituencyId: ps101.id }),
        upsertUser(passwordHash, { email: 'hiba.voter@iballot.com', phone: '+923001111116', cnic: '35202-1111111-6', fatherName: 'Hiba Ali', province: 'Punjab', city: 'Lahore', constituencyId: na120.id, isVerified: false }),
        upsertUser(passwordHash, { email: 'danish.voter@iballot.com', phone: '+923001111117', cnic: '35202-1111111-7', fatherName: 'Danish Akram', province: 'Punjab', city: 'Lahore', constituencyId: pp149.id, isActive: false }),
        upsertUser(passwordHash, { email: 'overseas.voter@iballot.com', phone: '+923001111118', cnic: '35202-1111111-8', fatherName: 'Overseas Voter', province: 'Punjab', city: 'Lahore', constituencyId: na121.id, isOverseas: true }),
    ]);
    const candidateUsers = await Promise.all([
        upsertUser(passwordHash, { email: 'candidate.rashid@iballot.com', phone: '+923002222221', cnic: '35202-2222222-1', role: client_1.Role.CANDIDATE, fatherName: 'Dr. Yasir Rashid', province: 'Punjab', city: 'Lahore', constituencyId: na120.id }),
        upsertUser(passwordHash, { email: 'candidate.waheed@iballot.com', phone: '+923002222222', cnic: '35202-2222222-2', role: client_1.Role.CANDIDATE, fatherName: 'Waheed Alam Khan', province: 'Punjab', city: 'Lahore', constituencyId: na120.id }),
        upsertUser(passwordHash, { email: 'candidate.zubair@iballot.com', phone: '+923002222223', cnic: '35202-2222222-3', role: client_1.Role.CANDIDATE, fatherName: 'Zubair Kardar', province: 'Punjab', city: 'Lahore', constituencyId: na120.id }),
        upsertUser(passwordHash, { email: 'candidate.sajida@iballot.com', phone: '+923002222224', cnic: '35202-2222222-4', role: client_1.Role.CANDIDATE, fatherName: 'Sajida Mir', province: 'Punjab', city: 'Lahore', constituencyId: na120.id }),
        upsertUser(passwordHash, { email: 'candidate.hafiz@iballot.com', phone: '+923002222225', cnic: '35202-2222222-5', role: client_1.Role.CANDIDATE, fatherName: 'Hafiz Mian', province: 'Punjab', city: 'Lahore', constituencyId: na120.id }),
        upsertUser(passwordHash, { email: 'candidate.ahmed@iballot.com', phone: '+923002222226', cnic: '35202-2222222-6', role: client_1.Role.CANDIDATE, fatherName: 'Ahmed Ali', province: 'Punjab', city: 'Lahore', constituencyId: na120.id }),
        upsertUser(passwordHash, { email: 'candidate.rabia@iballot.com', phone: '+923002222227', cnic: '35202-2222222-7', role: client_1.Role.CANDIDATE, fatherName: 'Rabia Sultan', province: 'Punjab', city: 'Rawalpindi', constituencyId: lb47.id }),
        upsertUser(passwordHash, { email: 'candidate.adnan@iballot.com', phone: '+923002222228', cnic: '35202-2222222-8', role: client_1.Role.CANDIDATE, fatherName: 'Adnan Hussain', province: 'Punjab', city: 'Rawalpindi', constituencyId: lb47.id }),
        upsertUser(passwordHash, { email: 'candidate.sheharyar@iballot.com', phone: '+923002222229', cnic: '35202-2222222-9', role: client_1.Role.CANDIDATE, fatherName: 'Sheharyar Khan', province: 'Sindh', city: 'Karachi', constituencyId: ps101.id }),
        upsertUser(passwordHash, { email: 'candidate.hina@iballot.com', phone: '+923002222230', cnic: '35202-2222223-0', role: client_1.Role.CANDIDATE, fatherName: 'Hina Qureshi', province: 'Sindh', city: 'Karachi', constituencyId: ps101.id }),
    ]);
    const elections = {
        activeGeneral: await findOrCreateElection({ title: 'General Election 2024', description: 'National Assembly election for NA-120 Lahore with live voting enabled.', type: client_1.ElectionType.GENERAL, status: client_1.ElectionStatus.ACTIVE, startDate: addDays(-1), endDate: addDays(5), createdBy: admin.id, constituencyId: na120.id }),
        upcomingMunicipal: await findOrCreateElection({ title: 'Municipal By-Election 2026', description: 'District 47 local body election scheduled for the next quarter.', type: client_1.ElectionType.BY_ELECTION, status: client_1.ElectionStatus.PUBLISHED, startDate: addDays(18), endDate: addDays(20), createdBy: lahoreAdmin.id, constituencyId: lb47.id }),
        senatePaused: await findOrCreateElection({ title: 'Senate Vacancy 2026', description: 'Senate replacement election temporarily paused for legal review.', type: client_1.ElectionType.SENATE, status: client_1.ElectionStatus.PAUSED, startDate: addDays(-2), endDate: addDays(3), createdBy: admin.id, constituencyId: na121.id }),
        provincialPublished: await findOrCreateElection({ title: 'Provincial Assembly By-Election 2025', description: 'Provincial seat election with officially published results.', type: client_1.ElectionType.PROVINCIAL_ASSEMBLY, status: client_1.ElectionStatus.RESULTS_PUBLISHED, startDate: addDays(-120), endDate: addDays(-117), createdBy: lahoreAdmin.id, constituencyId: pp149.id, resultsPublishedAt: addDays(-115) }),
        nationalPublished: await findOrCreateElection({ title: 'National Assembly Special Vote 2025', description: 'Completed and published national assembly vote for Lahore East.', type: client_1.ElectionType.NATIONAL_ASSEMBLY, status: client_1.ElectionStatus.RESULTS_PUBLISHED, startDate: addDays(-220), endDate: addDays(-217), createdBy: admin.id, constituencyId: na121.id, resultsPublishedAt: addDays(-215) }),
        closedUniversity: await findOrCreateElection({ title: 'University Senate Election 2025', description: 'Closed election awaiting official result publication.', type: client_1.ElectionType.UNIVERSITY, status: client_1.ElectionStatus.CLOSED, startDate: addDays(-30), endDate: addDays(-28), createdBy: admin.id, constituencyId: na120.id }),
        karachiPublished: await findOrCreateElection({ title: 'Karachi South Local Results 2025', description: 'Published local body results for Karachi South.', type: client_1.ElectionType.LOCAL_BODY, status: client_1.ElectionStatus.RESULTS_PUBLISHED, startDate: addDays(-70), endDate: addDays(-67), createdBy: karachiAdmin.id, constituencyId: ps101.id, resultsPublishedAt: addDays(-65) }),
    };
    const candidateDefs = [
        { user: candidateUsers[0], electionId: elections.activeGeneral.id, partyId: parties.pti.id, status: client_1.CandidateStatus.APPROVED, approvedBy: lahoreAdmin.id, approvedAt: addDays(-7), experience: '15 years in public service', manifesto: 'Expand public education funding, upgrade hospitals, and digitize citizen services.', promises: ['New schools in NA-120', '24/7 emergency clinics'], profileViews: 1480, count: 0 },
        { user: candidateUsers[1], electionId: elections.activeGeneral.id, partyId: parties.pmln.id, status: client_1.CandidateStatus.APPROVED, approvedBy: lahoreAdmin.id, approvedAt: addDays(-7), experience: 'Former Mayor of Lahore', manifesto: 'Strengthen law and order, small business support, and urban transport.', promises: ['Market grants for traders', 'Safer streets'], profileViews: 1360, count: 0 },
        { user: candidateUsers[2], electionId: elections.activeGeneral.id, partyId: parties.ppp.id, status: client_1.CandidateStatus.APPROVED, approvedBy: lahoreAdmin.id, approvedAt: addDays(-6), experience: 'Human rights advocate', manifesto: 'Promote social justice, public jobs, and affordable utilities.', promises: ['Skill centers for youth', 'Utility relief program'], profileViews: 1210, count: 0 },
        { user: candidateUsers[3], electionId: elections.activeGeneral.id, partyId: parties.independent.id, status: client_1.CandidateStatus.APPROVED, approvedBy: lahoreAdmin.id, approvedAt: addDays(-6), experience: 'Community leader', manifesto: 'Independent platform focused on women-led entrepreneurship and clean governance.', promises: ['Women business incubators', 'Water quality improvements'], profileViews: 1095, count: 0 },
        { user: candidateUsers[4], electionId: elections.activeGeneral.id, partyId: parties.ji.id, status: client_1.CandidateStatus.PENDING, experience: 'Social worker', manifesto: 'Community-first local representation with neighborhood issue desks.', promises: ['Union council help desks'], profileViews: 320, count: 0 },
        { user: candidateUsers[5], electionId: elections.activeGeneral.id, partyId: parties.independent.id, status: client_1.CandidateStatus.REJECTED, experience: 'Newcomer', manifesto: 'Independent reform campaign with incomplete nomination documents.', promises: ['Administrative reform'], profileViews: 250, count: 0 },
        { user: candidateUsers[6], electionId: elections.upcomingMunicipal.id, partyId: parties.independent.id, status: client_1.CandidateStatus.APPROVED, approvedBy: lahoreAdmin.id, approvedAt: addDays(-5), experience: 'Urban planner', manifesto: 'Better sanitation, women safety transport, and digital complaint management.', promises: ['Daily garbage route tracking', 'Women shuttle program'], profileViews: 610, count: 0 },
        { user: candidateUsers[7], electionId: elections.upcomingMunicipal.id, partyId: parties.pmln.id, status: client_1.CandidateStatus.APPROVED, approvedBy: lahoreAdmin.id, approvedAt: addDays(-5), experience: 'Local councillor', manifesto: 'Road maintenance, water supply stability, and fast permit services.', promises: ['Street maintenance crews', 'Water leakage hotline'], profileViews: 590, count: 0 },
        { user: candidateUsers[8], electionId: elections.karachiPublished.id, partyId: parties.ji.id, status: client_1.CandidateStatus.APPROVED, approvedBy: karachiAdmin.id, approvedAt: addDays(-90), experience: 'Karachi business owner', manifesto: 'Port-area job growth and community policing.', promises: ['Port training scholarships', 'Neighborhood patrol hubs'], profileViews: 900, count: 8421 },
        { user: candidateUsers[9], electionId: elections.karachiPublished.id, partyId: parties.ppp.id, status: client_1.CandidateStatus.APPROVED, approvedBy: karachiAdmin.id, approvedAt: addDays(-90), experience: 'Healthcare professional', manifesto: 'Healthcare expansion and girls education scholarships.', promises: ['Clinic upgrades', 'Scholarship fund'], profileViews: 930, count: 9013 },
    ];
    const candidates = {};
    for (const item of candidateDefs) {
        const candidate = await prisma.candidate.upsert({
            where: { userId: item.user.id },
            update: { electionId: item.electionId, partyId: item.partyId, status: item.status, approvedBy: item.approvedBy, approvedAt: item.approvedAt },
            create: { userId: item.user.id, electionId: item.electionId, partyId: item.partyId, status: item.status, approvedBy: item.approvedBy, approvedAt: item.approvedAt },
        });
        await prisma.candidateProfile.upsert({
            where: { candidateId: candidate.id },
            update: { photoUrl: item.user.photoUrl, manifesto: item.manifesto, experience: item.experience, promises: item.promises, profileViews: item.profileViews },
            create: { candidateId: candidate.id, photoUrl: item.user.photoUrl, manifesto: item.manifesto, experience: item.experience, promises: item.promises, profileViews: item.profileViews },
        });
        await prisma.candidateVoteCount.upsert({
            where: { candidateId: candidate.id },
            update: { electionId: item.electionId, count: item.count },
            create: { candidateId: candidate.id, electionId: item.electionId, count: item.count },
        });
        candidates[item.user.email] = candidate.id;
    }
    const voteSeeds = [
        { userId: voters[0].id, electionId: elections.nationalPublished.id, candidateId: candidates['candidate.zubair@iballot.com'], castedAt: addDays(-218) },
        { userId: voters[0].id, electionId: elections.closedUniversity.id, candidateId: candidates['candidate.waheed@iballot.com'], castedAt: addDays(-29) },
        { userId: voters[1].id, electionId: elections.activeGeneral.id, candidateId: candidates['candidate.waheed@iballot.com'], castedAt: addDays(0) },
        { userId: voters[2].id, electionId: elections.nationalPublished.id, candidateId: candidates['candidate.zubair@iballot.com'], castedAt: addDays(-218) },
        { userId: voters[4].id, electionId: elections.karachiPublished.id, candidateId: candidates['candidate.hina@iballot.com'], castedAt: addDays(-68) },
        { userId: voters[5].id, electionId: elections.provincialPublished.id, candidateId: candidates['candidate.zubair@iballot.com'], castedAt: addDays(-118) },
    ];
    for (const item of voteSeeds) {
        const hash = receiptHash(item.userId, item.electionId);
        await prisma.voteReceipt.upsert({
            where: { userId_electionId: { userId: item.userId, electionId: item.electionId } },
            update: { receiptHash: hash, castedAt: item.castedAt },
            create: { userId: item.userId, electionId: item.electionId, receiptHash: hash, castedAt: item.castedAt },
        });
        await prisma.vote.upsert({
            where: { receiptHash: hash },
            update: { electionId: item.electionId, candidateId: item.candidateId, castedAt: item.castedAt, encryptedData: `encrypted:${hash.slice(0, 24)}` },
            create: { electionId: item.electionId, candidateId: item.candidateId, receiptHash: hash, castedAt: item.castedAt, encryptedData: `encrypted:${hash.slice(0, 24)}` },
        });
    }
    await prisma.notification.deleteMany({ where: { userId: { in: voters.map((v) => v.id) } } });
    await prisma.notification.createMany({
        data: [
            { userId: voters[0].id, type: client_1.NotificationType.ELECTION_STARTED, title: 'General Election 2024 is live', message: 'Your constituency election is now active. Review candidates and cast your vote securely.', isRead: false },
            { userId: voters[0].id, type: client_1.NotificationType.RESULTS_PUBLISHED, title: 'Published results available', message: 'Official results are now available for one of your completed elections.', isRead: false },
            { userId: voters[0].id, type: client_1.NotificationType.VOTE_CONFIRMED, title: 'Previous vote receipt is available', message: 'You can view your participation receipt from the closed university election anytime.', isRead: true },
            { userId: voters[1].id, type: client_1.NotificationType.VOTE_CONFIRMED, title: 'Vote confirmed', message: 'Your vote for General Election 2024 has been recorded successfully.', isRead: false },
            { userId: voters[4].id, type: client_1.NotificationType.RESULTS_PUBLISHED, title: 'Karachi South results are out', message: 'Official results for Karachi South Local Results 2025 are now available.', isRead: false },
        ],
    });
    await prisma.fraudAlert.deleteMany({ where: { OR: [{ userId: voters[0].id }, { userId: voters[5].id }] } });
    await prisma.fraudAlert.createMany({
        data: [
            { userId: voters[5].id, type: client_1.FraudAlertType.DEVICE_MISMATCH, description: 'Verification was attempted from an unrecognized device during onboarding.', severity: client_1.AlertSeverity.MEDIUM, ipAddress: '192.168.10.15', isResolved: false },
            { userId: voters[0].id, type: client_1.FraudAlertType.RAPID_REQUESTS, description: 'Multiple rapid dashboard refresh requests were logged for monitoring.', severity: client_1.AlertSeverity.LOW, ipAddress: '192.168.10.9', isResolved: true, resolvedBy: lahoreAdmin.id },
        ],
    });
    await prisma.appeal.deleteMany({ where: { userId: { in: [voters[5].id, candidateUsers[5].id] } } });
    await prisma.appeal.createMany({
        data: [
            { userId: candidateUsers[5].id, type: client_1.AppealType.CANDIDATE_REJECTION, status: client_1.AppealStatus.PENDING, statement: 'I have uploaded corrected nomination papers and request review of my rejection.', evidence: ['nomination-correction.pdf', 'tax-clearance.pdf'] },
            { userId: voters[5].id, type: client_1.AppealType.VOTER_REJECTION, status: client_1.AppealStatus.PENDING, statement: 'Biometric verification failed during registration. Please review my CNIC and address documents manually.', evidence: ['cnic-front.jpg', 'utility-bill.pdf'] },
        ],
    });
    console.log('--- Seed completed successfully ---');
    console.log(`Password for seeded accounts: ${passwordPlain}`);
    console.log('Primary voter: voter@test.com');
    console.log('Admin: admin@iballot.com');
}
main()
    .catch((error) => {
    console.error(error);
    throw error;
})
    .finally(async () => {
    await prisma.$disconnect();
});
