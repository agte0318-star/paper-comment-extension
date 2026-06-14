window.PCE_DATA = {
  generatedAt: "2026-06-03T08:00:00.000Z",
  papers: [
    {
      id: "paper-1",
      paperKey: "doi:10.1002/smll.73674",
      title: "Key Strategies for Electrocatalytic C-N Coupling: From Reaction Pathways to Catalyst Engineering and Performance Evaluation",
      journal: "Small",
      publisher: "Wiley",
      year: 2026,
      url: "https://onlinelibrary.wiley.com/",
      commentCount: 42,
      ratingAverage: 8.7,
      ratingCount: 31,
      likeCount: 166,
      lastActiveAt: "2026-06-03T07:12:00.000Z",
      status: "active"
    },
    {
      id: "paper-2",
      paperKey: "doi:10.1038/s41586-026-00001-0",
      title: "A High-Resolution Map of Catalytic Interfaces Under Operating Conditions",
      journal: "Nature",
      publisher: "Springer Nature",
      year: 2026,
      url: "https://www.nature.com/articles/s41586-026-00001-0",
      commentCount: 36,
      ratingAverage: 9.1,
      ratingCount: 24,
      likeCount: 142,
      lastActiveAt: "2026-06-03T06:30:00.000Z",
      status: "active"
    },
    {
      id: "paper-3",
      paperKey: "doi:10.1126/science.adx0001",
      title: "Programmable Materials Discovery With Closed-Loop Robotic Laboratories",
      journal: "Science",
      publisher: "AAAS",
      year: 2026,
      url: "https://www.science.org/doi/10.1126/science.adx0001",
      commentCount: 29,
      ratingAverage: 8.4,
      ratingCount: 18,
      likeCount: 118,
      lastActiveAt: "2026-06-02T23:48:00.000Z",
      status: "active"
    },
    {
      id: "paper-4",
      paperKey: "doi:10.1021/acsnano.6c00001",
      title: "Strain-Tunable Charge Transport in Two-Dimensional Semiconductor Heterostructures",
      journal: "ACS Nano",
      publisher: "ACS",
      year: 2026,
      url: "https://pubs.acs.org/doi/10.1021/acsnano.6c00001",
      commentCount: 21,
      ratingAverage: 7.9,
      ratingCount: 15,
      likeCount: 74,
      lastActiveAt: "2026-06-02T19:22:00.000Z",
      status: "active"
    },
    {
      id: "paper-5",
      paperKey: "doi:10.1007/s12274-026-0001-1",
      title: "Scalable Synthesis of Defect-Engineered Nanomaterials for Energy Conversion",
      journal: "Nano Research",
      publisher: "Tsinghua University Press / Springer",
      year: 2026,
      url: "https://www.sciopen.com/",
      commentCount: 18,
      ratingAverage: 8.2,
      ratingCount: 12,
      likeCount: 69,
      lastActiveAt: "2026-06-02T14:04:00.000Z",
      status: "active"
    }
  ],
  comments: [
    {
      id: "comment-1",
      paperId: "paper-1",
      author: "materials_reader",
      userRole: "verified",
      content: "The review is useful because it separates reaction pathway evidence from catalyst performance claims. I would still like to see clearer criteria for comparing reported Faradaic efficiencies across different electrolyte systems.",
      likeCount: 54,
      ratingScore: 9,
      status: "visible",
      reportCount: 0,
      createdAt: "2026-06-03T07:12:00.000Z"
    },
    {
      id: "comment-2",
      paperId: "paper-2",
      author: "surface_lab",
      userRole: "verified",
      content: "The operando evidence is strong, especially the way the authors connect transient interface states to product selectivity. The main weakness is that the supplementary control experiments are hard to compare across catalyst batches.",
      likeCount: 48,
      ratingScore: 9,
      status: "visible",
      reportCount: 1,
      createdAt: "2026-06-03T06:30:00.000Z"
    },
    {
      id: "comment-3",
      paperId: "paper-3",
      author: "robotics_postdoc",
      userRole: "standard",
      content: "The closed-loop workflow is compelling, but the paper could better separate algorithmic novelty from engineering integration. The benchmark baseline feels too narrow for the breadth of the claim.",
      likeCount: 33,
      ratingScore: 8,
      status: "visible",
      reportCount: 0,
      createdAt: "2026-06-02T23:48:00.000Z"
    },
    {
      id: "comment-4",
      paperId: "paper-4",
      author: "nano_methods",
      userRole: "standard",
      content: "The transport data look internally consistent. I would trust the central claim more if the authors included a stronger discussion of strain relaxation and contact resistance artifacts.",
      likeCount: 22,
      ratingScore: 8,
      status: "visible",
      reportCount: 0,
      createdAt: "2026-06-02T19:22:00.000Z"
    },
    {
      id: "comment-5",
      paperId: "paper-5",
      author: "chem_evaluator",
      userRole: "standard",
      content: "The synthesis route is practical and the characterization is broad. The mechanism section is the least mature part: several defect assignments seem plausible but not uniquely supported.",
      likeCount: 19,
      ratingScore: 8,
      status: "visible",
      reportCount: 2,
      createdAt: "2026-06-02T14:04:00.000Z"
    }
  ],
  replies: [
    {
      id: "reply-1",
      commentId: "comment-1",
      paperId: "paper-1",
      userId: "user-3",
      author: "robotics_postdoc",
      content: "Thanks for the clarification, but this reply should be checked by a moderator.",
      status: "visible",
      paperKey: "doi:10.1002/smll.73674",
      createdAt: "2026-06-03T08:08:00.000Z"
    }
  ],
  reports: [
    {
      id: "report-1",
      reportType: "comment",
      targetType: "comment",
      targetId: "comment-2",
      commentId: "comment-2",
      reporter: "materials_reader",
      reason: "Potentially misleading",
      details: "Reporter says the batch comparison criticism needs citation.",
      status: "open",
      commentAuthor: "surface_lab",
      commentContent: "The operando evidence is strong, especially the way the authors connect transient interface states to product selectivity. The main weakness is that the supplementary control experiments are hard to compare across catalyst batches.",
      commentStatus: "visible",
      paperKey: "doi:10.1038/s41586-026-00001-0",
      createdAt: "2026-06-03T07:40:00.000Z"
    },
    {
      id: "report-2",
      reportType: "comment",
      targetType: "comment",
      targetId: "comment-5",
      commentId: "comment-5",
      reporter: "surface_lab",
      reason: "Tone",
      details: "Reporter says the comment is fair but too strongly worded.",
      status: "reviewing",
      commentAuthor: "chem_evaluator",
      commentContent: "The synthesis route is practical and the characterization is broad. The mechanism section is the least mature part: several defect assignments seem plausible but not uniquely supported.",
      commentStatus: "visible",
      paperKey: "doi:10.1007/s12274-026-0001-1",
      createdAt: "2026-06-02T16:18:00.000Z"
    },
    {
      id: "reply-report-1",
      reportType: "reply",
      targetType: "reply",
      targetId: "reply-1",
      replyId: "reply-1",
      reporter: "robotics_postdoc",
      reason: "Spam",
      details: "Sample reply report for local admin preview.",
      status: "open",
      commentAuthor: "local_reader",
      commentContent: "Thanks for the clarification, but this reply should be checked by a moderator.",
      commentStatus: "visible",
      paperKey: "doi:10.1002/smll.73674",
      createdAt: "2026-06-03T08:10:00.000Z"
    }
  ],
  users: [
    { id: "user-1", name: "materials_reader", role: "user", status: "active", commentCount: 9, reportCount: 1 },
    { id: "user-2", name: "surface_lab", role: "moderator", status: "active", commentCount: 14, reportCount: 1 },
    { id: "user-3", name: "robotics_postdoc", role: "user", status: "active", commentCount: 4, reportCount: 1 },
    { id: "user-4", name: "spam_candidate", role: "user", status: "suspended", commentCount: 2, reportCount: 0 }
  ],
  actions: [
    {
      id: "audit-1",
      actorId: "user-2",
      actor: "surface_lab",
      actionType: "update_report_status",
      targetType: "comment_report",
      targetId: "report-2",
      previousStatus: "open",
      newStatus: "reviewing",
      createdAt: "2026-06-03T08:22:00.000Z"
    },
    {
      id: "audit-2",
      actorId: "user-2",
      actor: "surface_lab",
      actionType: "update_user_status",
      targetType: "user",
      targetId: "user-4",
      previousStatus: "active",
      newStatus: "suspended",
      createdAt: "2026-06-03T08:18:00.000Z"
    }
  ]
};
