import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { NotificationModel } from "../../../models/notification.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/user/dashboard
export class DashboardController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;
      const userEmail = req.user.email;

      // ===========================================
      // 1️⃣ VOTACIONES COMO OWNER
      // ===========================================
      const asOwner = await dbBreaker.call(
        () => VotationModel.find({ ownerId: userId })
          .sort({ created_at: -1 })
          .limit(5)
          .select("subject description closes_at created_at")
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      // ===========================================
      // 2️⃣ VOTACIONES COMO MIEMBRO
      // ===========================================
      const memberRecords = await dbBreaker.call(
        () => AdminMemberByVotationModel.find({ 
          invitedEmail: userEmail,
          status: "ACCEPTED"
        }).select("votationid ROLES").lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const memberVotationIds = memberRecords.map(m => m.votationid.toString());

      const asMember = await dbBreaker.call(
        () => VotationModel.find({ 
          _id: { $in: memberVotationIds.map(id => new mongoose.Types.ObjectId(id)) } 
        })
          .sort({ created_at: -1 })
          .limit(5)
          .select("subject description closes_at created_at ownerId")
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const asMemberVotationMap = new Map(
        memberRecords.map(m => [m.votationid.toString(), m])
      );

      const asMemberWithRole = asMember.map(v => ({
        id: v._id,
        subject: v.subject,
        description: v.description,
        closesAt: v.closes_at,
        createdAt: v.created_at,
        role: asMemberVotationMap.get(v._id.toString())?.ROLES || "ONLYREAD",
        isOwner: false,
        status: new Date(v.closes_at) > new Date() ? "active" : "closed"
      }));

      // ===========================================
      // 3️⃣ PRÓXIMAS A CERRAR (deadlines)
      // ===========================================
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const allUsersVotationIds = [
        ...asOwner.map(v => v._id.toString()),
        ...memberVotationIds
      ];

      const upComingDeadLines = await dbBreaker.call(
        () => VotationModel.find({
          _id: { $in: allUsersVotationIds.map(id => new mongoose.Types.ObjectId(id)) },
          closes_at: { $gt: now, $lt: sevenDaysFromNow }
        })
          .sort({ closes_at: 1 })
          .limit(3)
          .select("subject closes_at ownerId")
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const upcomingWithRole = upComingDeadLines.map(v => ({
        id: v._id,
        title: v.subject,
        closesAt: v.closes_at,
        closesIn: Math.ceil((new Date(v.closes_at) - now) / (1000 * 60 * 60 * 24)),
        role: v.ownerId.toString() === userId ? "owner" : "member"
      }));

      // ===========================================
      // 4️⃣ ACTIVIDAD RECIENTE
      // ===========================================
      const recentActivity = [
        ...asOwner.slice(0, 3).map(v => ({
          type: "votation_created",
          id: v._id,
          title: v.subject,
          role: "owner",
          timestamp: v.created_at
        })),
        ...asMemberWithRole.slice(0, 3).map(v => ({
          type: "votation_participating",
          id: v.id,
          title: v.subject,
          role: v.role,
          timestamp: v.createdAt
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

      // ===========================================
      // 5️⃣ CONTADORES (summary)
      // ===========================================
      const totalAsOwnerResult = await dbBreaker.call(
        () => VotationModel.countDocuments({ ownerId: userId }),
        fallBacksBreaker.fallBackZero
      );
      const totalAsOwner = totalAsOwnerResult;

      const totalAsMember = memberVotationIds.length;

      const pendingInvitationsResult = await dbBreaker.call(
        () => AdminMemberByVotationModel.countDocuments({
          invitedEmail: userEmail,
          status: "PENDING"
        }),
        fallBacksBreaker.fallBackZero
      );
      const pendingInvitations = pendingInvitationsResult;

      const unreadNotificationsResult = await dbBreaker.call(
        () => NotificationModel.countDocuments({
          userId,
          read: false
        }),
        fallBacksBreaker.fallBackZero
      );
      const unreadNotifications = unreadNotificationsResult;

      // ===========================================
      // 6️⃣ QUICK ACTIONS
      // ===========================================
      const canInvite = totalAsOwner > 0 || memberRecords.some(m => m.ROLES === "EDIT");

      // ===========================================
      // 7️⃣ RESPUESTA FINAL
      // ===========================================
      return res.json({
        ok: true,
        data: {
          summary: {
            totalVotations: totalAsOwner + totalAsMember,
            asOwner: totalAsOwner,
            asMember: totalAsMember,
            pendingInvitations,
            unreadNotifications
          },
          myVotations: {
            asOwner: asOwner.map(v => ({
              id: v._id,
              subject: v.subject,
              description: v.description,
              closesAt: v.closes_at,
              createdAt: v.created_at,
              status: new Date(v.closes_at) > now ? "active" : "closed"
            })),
            asMember: asMemberWithRole
          },
          upcomingDeadlines: upcomingWithRole,
          recentActivity,
          quickActions: {
            canCreate: true,
            canInvite,
            pendingTasks: pendingInvitations + unreadNotifications
          }
        }
      });

    } catch (err) {
      console.error("Error en DashboardController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener dashboard"
      });
    }
  };
}