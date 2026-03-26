"""Seed data: SQF framework + demo engagement for Lincoln Innovation Academy."""

import json
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.action_plan import ActionItem, ActionPlan, ItemStatus, PlanStatus
from app.models.activity import ActivityLog
from app.models.data_request import DataRequest, DataRequestComment, RequestPriority, RequestStatus
from app.models.engagement import Engagement, EngagementMember, EngagementRole, EngagementStage
from app.models.engagement_framework import EngagementComponent, EngagementDimension
from app.models.evidence import Evidence, EvidenceExtraction, EvidenceMapping, EvidenceType, ProcessingStatus
from app.models.framework import Component, CriterionType, Dimension, SuccessCriterion
from app.models.messaging import Message, MessageThread, ThreadType
from app.models.school import School
from app.models.scoring import ComponentScore, DimensionSummary, GlobalSummary, RatingLevel, ScoreStatus
from app.services.framework_service import fork_sqf_directly_to_engagement

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "ai_assessments.json"


def _load_fixtures() -> dict | None:
    """Load pre-generated AI assessment fixtures if available."""
    if FIXTURES_PATH.is_file():
        with open(FIXTURES_PATH) as f:
            return json.load(f)
    return None

# Fixed UUIDs for demo data consistency
SCHOOL_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ENGAGEMENT_ID = uuid.UUID("10000000-0000-0000-0000-000000000001")
PLAN_ID = uuid.UUID("20000000-0000-0000-0000-000000000001")

# ============================================================
# SQF FRAMEWORK DATA
# Based on Bellwether's publicly documented School Quality Framework
# 9 Dimensions, 43 Components, with hypothesized success criteria
# ============================================================

SQF_FRAMEWORK = [
    {
        "number": 1,
        "name": "Organizational Purpose",
        "color": "#6366F1",
        "description": "The foundational clarity of the school's mission, identity, and model.",
        "components": [
            {
                "code": "1A",
                "name": "Mission, Vision, and Values",
                "description": "The school has a clear, compelling mission, vision, and set of core values that guide all decisions and are understood by all stakeholders.",
                "evidence_guidance": "Mission/vision statements, strategic plans, stakeholder surveys, board documents, marketing materials",
                "criteria": [
                    ("core_action", "Mission, vision, and values are clearly articulated in written documents and communications"),
                    ("core_action", "Leadership regularly references mission/vision in decision-making and communications"),
                    ("core_action", "Mission/vision are reviewed and refreshed with stakeholder input on a regular cycle"),
                    ("progress_indicator", "Staff can articulate the mission and connect it to their daily work"),
                    ("progress_indicator", "Families and students can describe the school's core purpose and values"),
                    ("progress_indicator", "Key decisions and resource allocations demonstrably align with stated mission"),
                ]
            },
            {
                "code": "1B",
                "name": "Student Success Profile",
                "description": "The school has a mission-aligned profile of the knowledge, skills, and mindsets students should demonstrate.",
                "evidence_guidance": "Graduate profile documents, curriculum maps, assessment frameworks, student work samples",
                "criteria": [
                    ("core_action", "A codified Student Success Profile has been developed with input from diverse stakeholders"),
                    ("core_action", "The profile is aligned to curriculum, instruction, and support systems"),
                    ("core_action", "Students have regular opportunities to reflect on their progress toward the profile"),
                    ("progress_indicator", "Staff can describe the Student Success Profile and how it shapes their practice"),
                    ("progress_indicator", "Students can articulate what they are working toward and why"),
                    ("progress_indicator", "Student work and assessment artifacts demonstrate progress toward profile elements"),
                ]
            },
            {
                "code": "1C",
                "name": "School/Program Model",
                "description": "The school's program model is coherent, distinctive, and aligned with its mission and student success profile.",
                "evidence_guidance": "Program model documentation, scheduling structures, course catalogs, distinctive program elements",
                "criteria": [
                    ("core_action", "The school's program model is clearly documented with rationale tied to mission"),
                    ("core_action", "Key model elements (schedule, structure, pedagogy) are intentionally designed and coherent"),
                    ("core_action", "The model is regularly evaluated for effectiveness and alignment"),
                    ("progress_indicator", "Stakeholders can describe what makes the school's model distinctive"),
                    ("progress_indicator", "Daily operations and scheduling reflect the intended program model"),
                    ("progress_indicator", "Evidence shows the model supports equitable outcomes for all student groups"),
                ]
            },
        ]
    },
    {
        "number": 2,
        "name": "Academic Program",
        "color": "#EC4899",
        "description": "The rigor, coherence, and effectiveness of the school's instructional program.",
        "components": [
            {
                "code": "2A",
                "name": "Academic Vision and Design",
                "description": "The school has a clear academic vision with a coherent instructional design that serves all learners.",
                "evidence_guidance": "Academic strategy documents, instructional framework, scope and sequence, curriculum guides",
                "criteria": [
                    ("core_action", "Academic vision is documented and aligned to the Student Success Profile"),
                    ("core_action", "Instructional design reflects research-based practices and is coherent across grades/subjects"),
                    ("core_action", "Academic programming is designed to be inclusive and serve diverse learners"),
                    ("progress_indicator", "Teachers can articulate the school's academic vision and how it shapes instruction"),
                    ("progress_indicator", "Classroom observations reveal consistent implementation of the instructional design"),
                    ("progress_indicator", "Student outcomes data shows progress aligned with the academic vision"),
                ]
            },
            {
                "code": "2B",
                "name": "Curriculum",
                "description": "The school uses high-quality, standards-aligned curricular materials that are effectively implemented.",
                "evidence_guidance": "Curriculum inventory, textbook/material lists, curriculum review records, pacing guides, lesson plans",
                "criteria": [
                    ("core_action", "High-quality, standards-aligned curricular materials are adopted in all core subjects"),
                    ("core_action", "Teachers receive training and ongoing support for curriculum implementation"),
                    ("core_action", "Curriculum is regularly reviewed for quality, alignment, and cultural relevance"),
                    ("progress_indicator", "Teachers report confidence in and fidelity to adopted curriculum"),
                    ("progress_indicator", "Classroom observations show curriculum being used with fidelity and adaptation"),
                    ("progress_indicator", "Student work reflects engagement with rigorous, grade-level content"),
                ]
            },
            {
                "code": "2C",
                "name": "Instruction",
                "description": "Teaching practice is consistently high quality, engaging, and responsive to student needs.",
                "evidence_guidance": "Observation protocols, coaching logs, teacher evaluations, student feedback, video of instruction",
                "criteria": [
                    ("core_action", "A clear instructional framework defines expectations for effective teaching"),
                    ("core_action", "Regular classroom observations with actionable feedback are conducted"),
                    ("core_action", "Instruction is differentiated to meet diverse student needs"),
                    ("progress_indicator", "Observation data shows high rates of student engagement and thinking"),
                    ("progress_indicator", "Teachers demonstrate growth in instructional practice over time"),
                    ("progress_indicator", "Students report that instruction is challenging, relevant, and supportive"),
                ]
            },
            {
                "code": "2D",
                "name": "Data and Assessment",
                "description": "The school uses a coherent assessment system to monitor learning and drive instructional decisions.",
                "evidence_guidance": "Assessment calendar, data protocols, data meeting agendas/notes, assessment results, data dashboards",
                "criteria": [
                    ("core_action", "A comprehensive assessment system includes diagnostic, formative, and summative measures"),
                    ("core_action", "Regular data analysis cycles are built into the school calendar"),
                    ("core_action", "Data is used to identify student needs and adjust instruction"),
                    ("progress_indicator", "Teachers regularly analyze student data and adjust practice accordingly"),
                    ("progress_indicator", "Leaders use assessment data to make school-wide instructional decisions"),
                    ("progress_indicator", "Students understand their own learning progress and goals"),
                ]
            },
            {
                "code": "2E",
                "name": "Academic Intervention and Enrichment",
                "description": "The school provides targeted academic supports and enrichment opportunities for all students.",
                "evidence_guidance": "Intervention program descriptions, RTI/MTSS documentation, enrichment offerings, student participation data",
                "criteria": [
                    ("core_action", "A tiered system of academic supports (RTI/MTSS) is implemented with fidelity"),
                    ("core_action", "Enrichment and acceleration opportunities are available to all students"),
                    ("core_action", "Intervention effectiveness is regularly monitored and adjusted"),
                    ("progress_indicator", "Students receiving interventions show measurable progress"),
                    ("progress_indicator", "Equitable access to enrichment is evident across student groups"),
                    ("progress_indicator", "Staff can describe the intervention system and their role in it"),
                ]
            },
            {
                "code": "2F",
                "name": "Special Populations Support",
                "description": "The school effectively serves students with disabilities, English learners, and other special populations.",
                "evidence_guidance": "IEP/504 compliance data, EL program descriptions, staffing for special populations, outcome data by subgroup",
                "criteria": [
                    ("core_action", "Specialized programs and services are in place for students with disabilities and English learners"),
                    ("core_action", "Special education and EL staff collaborate with general education teachers"),
                    ("core_action", "Compliance requirements are met and documentation is current"),
                    ("progress_indicator", "Students with disabilities and ELs show growth on appropriate measures"),
                    ("progress_indicator", "Inclusion practices are evident in classroom observations"),
                    ("progress_indicator", "Families of special populations report satisfaction with services"),
                ]
            },
            {
                "code": "2G",
                "name": "Postsecondary Support",
                "description": "The school prepares students for postsecondary success through advising, exposure, and transition support.",
                "evidence_guidance": "College/career readiness data, advising program documents, postsecondary acceptance rates, alumni tracking",
                "criteria": [
                    ("core_action", "A postsecondary advising program is in place with dedicated staff or time"),
                    ("core_action", "Students have exposure to diverse postsecondary pathways"),
                    ("core_action", "Transition support systems help students navigate postsecondary applications and enrollment"),
                    ("progress_indicator", "Students can articulate postsecondary goals and plans"),
                    ("progress_indicator", "College/career readiness indicators show improvement over time"),
                    ("progress_indicator", "Postsecondary enrollment and persistence data is tracked and used"),
                ]
            },
            {
                "code": "2H",
                "name": "Instructional Technology",
                "description": "Technology is used purposefully to enhance teaching and learning.",
                "evidence_guidance": "Technology plan, device ratios, EdTech inventory, professional development on technology, usage data",
                "criteria": [
                    ("core_action", "An instructional technology strategy is aligned with academic goals"),
                    ("core_action", "Teachers receive training on effective technology integration"),
                    ("core_action", "Technology resources are equitably distributed and maintained"),
                    ("progress_indicator", "Classroom observations show purposeful technology use that enhances learning"),
                    ("progress_indicator", "Students use technology for creation, collaboration, and critical thinking"),
                    ("progress_indicator", "Technology usage data shows consistent and equitable adoption"),
                ]
            },
        ]
    },
    {
        "number": 3,
        "name": "Student Culture",
        "color": "#F59E0B",
        "description": "The intentionality and quality of the school's student experience and culture systems.",
        "components": [
            {
                "code": "3A",
                "name": "Culture Vision and Design",
                "description": "The school has an intentional vision for student culture that is clearly designed and communicated.",
                "evidence_guidance": "Culture handbook, behavior policy, culture vision documents, staff training materials",
                "criteria": [
                    ("core_action", "A clear culture vision is documented and aligned with school mission"),
                    ("core_action", "Culture systems and structures are intentionally designed to reflect the vision"),
                    ("core_action", "Culture expectations are consistently communicated to all stakeholders"),
                    ("progress_indicator", "Students and staff can describe the culture vision and expectations"),
                    ("progress_indicator", "School climate surveys show positive trends"),
                    ("progress_indicator", "Behavioral data aligns with culture goals"),
                ]
            },
            {
                "code": "3B",
                "name": "Relationships",
                "description": "Strong, trusting relationships exist between students and adults, and among students.",
                "evidence_guidance": "Climate surveys, advisory/mentoring programs, student-teacher interaction observations, focus group data",
                "criteria": [
                    ("core_action", "Structures exist to build and maintain strong adult-student relationships (e.g., advisory)"),
                    ("core_action", "Staff model and teach relationship-building skills"),
                    ("core_action", "Students have regular opportunities to build peer relationships"),
                    ("progress_indicator", "Students report feeling known and valued by adults in the school"),
                    ("progress_indicator", "Climate data shows positive relationships across demographic groups"),
                    ("progress_indicator", "Observations reveal warm, respectful interactions between staff and students"),
                ]
            },
            {
                "code": "3C",
                "name": "Community-Building Practices",
                "description": "The school has regular practices that build a sense of belonging and shared identity.",
                "evidence_guidance": "Community meeting agendas, traditions documentation, attendance at events, student belonging data",
                "criteria": [
                    ("core_action", "Regular community-building routines are embedded in the school schedule"),
                    ("core_action", "Traditions and rituals reinforce school identity and values"),
                    ("core_action", "Community practices are inclusive and celebrate diversity"),
                    ("progress_indicator", "Students report a strong sense of belonging"),
                    ("progress_indicator", "Community events have high participation rates"),
                    ("progress_indicator", "School identity is visible in physical spaces and student artifacts"),
                ]
            },
            {
                "code": "3D",
                "name": "Social-Emotional Learning",
                "description": "The school provides systematic social-emotional learning opportunities for all students.",
                "evidence_guidance": "SEL curriculum/program, SEL assessment data, counseling services documentation, staff training records",
                "criteria": [
                    ("core_action", "An evidence-based SEL curriculum or approach is implemented school-wide"),
                    ("core_action", "Staff are trained in SEL practices and integrate them into instruction"),
                    ("core_action", "SEL competencies are assessed and monitored"),
                    ("progress_indicator", "Students demonstrate growth in SEL competencies"),
                    ("progress_indicator", "Classroom observations reveal SEL integration in instruction"),
                    ("progress_indicator", "Behavioral and climate data reflect strong SEL outcomes"),
                ]
            },
            {
                "code": "3E",
                "name": "Behavior Management System",
                "description": "The school has a fair, consistent, and restorative approach to student behavior.",
                "evidence_guidance": "Behavior policy, discipline data (disaggregated), restorative practices documentation, referral processes",
                "criteria": [
                    ("core_action", "A clear behavior management system with progressive responses is documented"),
                    ("core_action", "Restorative practices are used as a primary response to behavioral issues"),
                    ("core_action", "Discipline data is regularly reviewed for equity and effectiveness"),
                    ("progress_indicator", "Suspension and exclusionary discipline rates are low and equitable across groups"),
                    ("progress_indicator", "Staff consistently apply behavior expectations"),
                    ("progress_indicator", "Students understand the behavior system and perceive it as fair"),
                ]
            },
            {
                "code": "3F",
                "name": "Wraparound Supports",
                "description": "The school connects students and families to comprehensive support services.",
                "evidence_guidance": "Support services inventory, referral data, partnership agreements, counselor caseload data",
                "criteria": [
                    ("core_action", "Comprehensive support services address students' physical, mental, and social needs"),
                    ("core_action", "Referral systems connect students to internal and external support providers"),
                    ("core_action", "Staff are trained to identify students who need additional support"),
                    ("progress_indicator", "Students in need of support are identified and served in a timely manner"),
                    ("progress_indicator", "Families report awareness of and access to support services"),
                    ("progress_indicator", "Student attendance, engagement, and well-being indicators improve"),
                ]
            },
        ]
    },
    {
        "number": 4,
        "name": "Talent",
        "color": "#10B981",
        "description": "The school's approach to recruiting, developing, and retaining high-quality staff.",
        "components": [
            {
                "code": "4A",
                "name": "Talent Philosophy",
                "description": "The school has a clear philosophy about the kind of talent it needs and how it develops people.",
                "evidence_guidance": "Talent strategy documents, hiring rubrics, competency frameworks, HR policies",
                "criteria": [
                    ("core_action", "A talent philosophy is documented and aligned with school mission and model"),
                    ("core_action", "Desired staff competencies and dispositions are clearly defined"),
                    ("core_action", "The talent philosophy informs all hiring, development, and retention decisions"),
                    ("progress_indicator", "Leaders can articulate the talent philosophy and its connection to school success"),
                    ("progress_indicator", "Hiring decisions demonstrably align with stated talent criteria"),
                    ("progress_indicator", "Staff report understanding of growth expectations and career development"),
                ]
            },
            {
                "code": "4B",
                "name": "Staff Culture",
                "description": "The school fosters a positive, collaborative, and mission-aligned staff culture.",
                "evidence_guidance": "Staff surveys, retention data, staff meeting agendas, collaboration structures, staff testimonials",
                "criteria": [
                    ("core_action", "Intentional structures support staff collaboration and community-building"),
                    ("core_action", "Staff input is valued and incorporated into school decisions"),
                    ("core_action", "Staff well-being and work-life balance are actively supported"),
                    ("progress_indicator", "Staff survey data shows high satisfaction and engagement"),
                    ("progress_indicator", "Teacher retention rates are strong relative to comparison schools"),
                    ("progress_indicator", "Staff describe the culture as collaborative and mission-driven"),
                ]
            },
            {
                "code": "4C",
                "name": "Recruitment, Hiring, and Onboarding",
                "description": "The school effectively recruits, selects, and onboards staff aligned with its mission and needs.",
                "evidence_guidance": "Recruitment plan, hiring rubrics, onboarding schedule, new hire surveys, diversity hiring data",
                "criteria": [
                    ("core_action", "A proactive recruitment strategy targets diverse, mission-aligned candidates"),
                    ("core_action", "Hiring processes include rigorous selection criteria and performance tasks"),
                    ("core_action", "A structured onboarding program prepares new staff for success"),
                    ("progress_indicator", "Applicant pools are diverse and competitive"),
                    ("progress_indicator", "New hires report feeling prepared and supported"),
                    ("progress_indicator", "First-year retention rates are strong"),
                ]
            },
            {
                "code": "4D",
                "name": "Professional Development, Coaching, and Evaluation",
                "description": "The school provides effective, differentiated professional learning and meaningful evaluation.",
                "evidence_guidance": "PD calendar and agendas, coaching logs, evaluation rubrics and results, teacher growth data",
                "criteria": [
                    ("core_action", "A coherent professional development plan is aligned with school goals and teacher needs"),
                    ("core_action", "Regular coaching and feedback cycles are embedded in the school model"),
                    ("core_action", "A fair, transparent evaluation system drives growth and accountability"),
                    ("progress_indicator", "Teachers report that PD is relevant and improves their practice"),
                    ("progress_indicator", "Coaching data shows teacher growth on key instructional indicators"),
                    ("progress_indicator", "Evaluation outcomes correlate with student achievement data"),
                ]
            },
            {
                "code": "4E",
                "name": "Career Pathways and Succession Planning",
                "description": "The school develops leadership capacity and creates pathways for growth and succession.",
                "evidence_guidance": "Career ladder documentation, leadership development programs, succession plans, internal promotion data",
                "criteria": [
                    ("core_action", "Career pathways exist for teachers and staff to grow within the organization"),
                    ("core_action", "Leadership development is intentionally cultivated among high-potential staff"),
                    ("core_action", "Succession planning addresses key leadership positions"),
                    ("progress_indicator", "Internal candidates are prepared for and competitive for leadership roles"),
                    ("progress_indicator", "Staff perceive opportunities for growth and advancement"),
                    ("progress_indicator", "Leadership transitions are smooth and minimally disruptive"),
                ]
            },
        ]
    },
    {
        "number": 5,
        "name": "Leadership",
        "color": "#8B5CF6",
        "description": "The quality, structure, and effectiveness of school leadership.",
        "components": [
            {
                "code": "5A",
                "name": "Organizational Structure",
                "description": "The school has a clear, effective organizational structure with defined roles and responsibilities.",
                "evidence_guidance": "Org chart, job descriptions, role clarity documentation, leadership team structure",
                "criteria": [
                    ("core_action", "An organizational chart clearly defines roles, reporting lines, and responsibilities"),
                    ("core_action", "The leadership team structure supports effective decision-making and accountability"),
                    ("core_action", "Roles are designed to distribute leadership and avoid bottlenecks"),
                    ("progress_indicator", "Staff report clarity about their roles and who to go to for different needs"),
                    ("progress_indicator", "The organizational structure supports effective communication and decision-making"),
                    ("progress_indicator", "Leadership capacity is distributed rather than concentrated in one person"),
                ]
            },
            {
                "code": "5B",
                "name": "Decision-Making Structures",
                "description": "The school has clear, transparent processes for making and communicating decisions.",
                "evidence_guidance": "Decision-making frameworks, committee structures, meeting agendas/minutes, staff input mechanisms",
                "criteria": [
                    ("core_action", "Decision rights are clearly defined (who decides what and how)"),
                    ("core_action", "Input from diverse stakeholders is systematically gathered for key decisions"),
                    ("core_action", "Decisions are communicated transparently with rationale"),
                    ("progress_indicator", "Staff report understanding of how decisions are made"),
                    ("progress_indicator", "Key decisions reflect stakeholder input"),
                    ("progress_indicator", "Decision-making processes are perceived as fair and efficient"),
                ]
            },
            {
                "code": "5C",
                "name": "Internal Communications",
                "description": "The school has effective systems for internal information sharing and communication.",
                "evidence_guidance": "Communication tools and channels, staff meeting structures, information flow documentation",
                "criteria": [
                    ("core_action", "Clear communication channels and norms are established for different types of information"),
                    ("core_action", "Regular meeting structures ensure alignment and information sharing"),
                    ("core_action", "Communication systems are evaluated and improved based on feedback"),
                    ("progress_indicator", "Staff report feeling well-informed about important school matters"),
                    ("progress_indicator", "Meetings are perceived as productive and well-organized"),
                    ("progress_indicator", "Information reaches all staff in a timely and accessible manner"),
                ]
            },
            {
                "code": "5D",
                "name": "Strategic Planning",
                "description": "The school engages in rigorous strategic planning that guides long-term direction.",
                "evidence_guidance": "Strategic plan, annual goals, progress reports, planning process documentation",
                "criteria": [
                    ("core_action", "A multi-year strategic plan exists with clear goals, strategies, and metrics"),
                    ("core_action", "The strategic plan was developed with broad stakeholder input"),
                    ("core_action", "Progress against strategic goals is regularly monitored and reported"),
                    ("progress_indicator", "Staff can connect their work to strategic priorities"),
                    ("progress_indicator", "Resource allocation decisions align with strategic goals"),
                    ("progress_indicator", "The school demonstrates progress on key strategic metrics"),
                ]
            },
            {
                "code": "5E",
                "name": "Innovation Leadership",
                "description": "Leadership fosters innovation, continuous improvement, and adaptive change.",
                "evidence_guidance": "Innovation initiatives, pilot programs, change management processes, continuous improvement data",
                "criteria": [
                    ("core_action", "Leadership creates space and systems for piloting new approaches"),
                    ("core_action", "A culture of continuous improvement and learning from failure is cultivated"),
                    ("core_action", "Change management practices support smooth implementation of innovations"),
                    ("progress_indicator", "Staff feel empowered to suggest and try new approaches"),
                    ("progress_indicator", "Innovations are evaluated and scaled or discontinued based on evidence"),
                    ("progress_indicator", "The school demonstrates adaptability in response to changing needs"),
                ]
            },
        ]
    },
    {
        "number": 6,
        "name": "External Engagement",
        "color": "#F97316",
        "description": "The school's relationships with families, community, and external stakeholders.",
        "components": [
            {
                "code": "6A",
                "name": "Caregiver Engagement",
                "description": "The school builds strong, two-way relationships with families and caregivers.",
                "evidence_guidance": "Family engagement plan, event attendance, family survey data, communication logs, volunteer data",
                "criteria": [
                    ("core_action", "A family engagement strategy is documented and goes beyond one-way communication"),
                    ("core_action", "Multiple, accessible channels exist for family-school communication"),
                    ("core_action", "Families have meaningful roles in school decisions and student learning"),
                    ("progress_indicator", "Family survey data shows high engagement and satisfaction"),
                    ("progress_indicator", "Family participation rates are strong across demographic groups"),
                    ("progress_indicator", "Families report feeling welcomed, respected, and heard"),
                ]
            },
            {
                "code": "6B",
                "name": "Community Partnerships",
                "description": "The school leverages community partnerships to enhance student opportunities and school resources.",
                "evidence_guidance": "Partnership inventory, MOUs, partnership outcome data, community resource mapping",
                "criteria": [
                    ("core_action", "Strategic partnerships are aligned with school mission and student needs"),
                    ("core_action", "Partnership agreements define mutual expectations and outcomes"),
                    ("core_action", "Community resources are mapped and leveraged to fill gaps in school offerings"),
                    ("progress_indicator", "Partnerships result in tangible student opportunities or school improvements"),
                    ("progress_indicator", "Partners report satisfaction with the relationship and outcomes"),
                    ("progress_indicator", "Students benefit from expanded learning and support through partnerships"),
                ]
            },
            {
                "code": "6C",
                "name": "External Communications/Public Relations",
                "description": "The school communicates effectively with external audiences and manages its public reputation.",
                "evidence_guidance": "Website, social media presence, press coverage, marketing materials, enrollment data trends",
                "criteria": [
                    ("core_action", "An external communications strategy exists and is regularly executed"),
                    ("core_action", "The school's website and social media presence are current and compelling"),
                    ("core_action", "Key messages are consistent and aligned with mission and brand"),
                    ("progress_indicator", "Community awareness and perception of the school are positive"),
                    ("progress_indicator", "Enrollment demand is healthy relative to capacity"),
                    ("progress_indicator", "Media coverage and public mentions are generally favorable"),
                ]
            },
            {
                "code": "6D",
                "name": "Development",
                "description": "The school has a sustainable approach to fundraising and resource development.",
                "evidence_guidance": "Development plan, fundraising data, donor relationships, grant portfolio, revenue diversification",
                "criteria": [
                    ("core_action", "A development plan with diversified funding strategies is in place"),
                    ("core_action", "Donor and funder relationships are intentionally cultivated and stewarded"),
                    ("core_action", "Grant and fundraising efforts are aligned with strategic priorities"),
                    ("progress_indicator", "Fundraising revenue meets or exceeds targets"),
                    ("progress_indicator", "Funding sources are diversified beyond a single major funder"),
                    ("progress_indicator", "Development capacity is sustainable and not over-reliant on one person"),
                ]
            },
        ]
    },
    {
        "number": 7,
        "name": "Governance",
        "color": "#EF4444",
        "description": "The effectiveness and structure of school governance and board oversight.",
        "components": [
            {
                "code": "7A",
                "name": "Accountability for School Success",
                "description": "The governing board holds the school accountable for student outcomes and mission achievement.",
                "evidence_guidance": "Board meeting minutes, performance dashboards, accountability policies, school leader goals",
                "criteria": [
                    ("core_action", "The board sets clear expectations for student outcomes and school performance"),
                    ("core_action", "Performance data is regularly reviewed at board meetings"),
                    ("core_action", "The board takes action when performance falls short of expectations"),
                    ("progress_indicator", "Board agendas consistently include student outcomes and performance review"),
                    ("progress_indicator", "Board members can describe school performance relative to goals"),
                    ("progress_indicator", "Performance accountability is balanced with support for school leadership"),
                ]
            },
            {
                "code": "7B",
                "name": "Leader Support and Evaluation",
                "description": "The board provides effective support, development, and evaluation for the school leader.",
                "evidence_guidance": "Leader evaluation policy, evaluation records, support structures, leader development plan",
                "criteria": [
                    ("core_action", "A formal school leader evaluation process is in place with clear criteria"),
                    ("core_action", "The board provides ongoing support and development opportunities for the leader"),
                    ("core_action", "Leader compensation and retention strategies are intentional"),
                    ("progress_indicator", "The school leader reports feeling supported and fairly evaluated"),
                    ("progress_indicator", "Leader evaluation results align with school performance data"),
                    ("progress_indicator", "Leadership stability is maintained over time"),
                ]
            },
            {
                "code": "7C",
                "name": "Board Structures",
                "description": "Board governance structures are well-designed and support effective oversight.",
                "evidence_guidance": "Board bylaws, committee structure, board member terms, meeting frequency, governance policies",
                "criteria": [
                    ("core_action", "Board bylaws and governance policies are documented and followed"),
                    ("core_action", "Committee structures support board effectiveness and workload distribution"),
                    ("core_action", "Board composition is intentionally managed for diversity of skills and perspectives"),
                    ("progress_indicator", "Board meetings are well-attended, well-run, and productive"),
                    ("progress_indicator", "Board members report clarity about their roles and responsibilities"),
                    ("progress_indicator", "Governance practices meet or exceed legal and authorizer requirements"),
                ]
            },
            {
                "code": "7D",
                "name": "Sector Engagement",
                "description": "The school engages productively with its authorizer, district, and broader education sector.",
                "evidence_guidance": "Authorizer communications, compliance records, sector participation, policy engagement",
                "criteria": [
                    ("core_action", "The school maintains a productive relationship with its authorizer or oversight body"),
                    ("core_action", "Compliance obligations are met consistently and proactively"),
                    ("core_action", "The school engages in sector-level conversations and advocacy when appropriate"),
                    ("progress_indicator", "Authorizer/oversight body communications indicate a positive relationship"),
                    ("progress_indicator", "Compliance issues are rare and addressed promptly"),
                    ("progress_indicator", "The school is recognized or sought out for sector contributions"),
                ]
            },
        ]
    },
    {
        "number": 8,
        "name": "Operations",
        "color": "#06B6D4",
        "description": "The efficiency and quality of school operations and infrastructure.",
        "components": [
            {
                "code": "8A",
                "name": "Technology and Data Infrastructure",
                "description": "The school has robust technology and data systems that support instruction and operations.",
                "evidence_guidance": "Technology inventory, data systems documentation, IT support structure, cybersecurity practices",
                "criteria": [
                    ("core_action", "Core data systems (SIS, LMS, assessment) are integrated and well-maintained"),
                    ("core_action", "Technology infrastructure supports reliable access for staff and students"),
                    ("core_action", "Data governance and cybersecurity practices are in place"),
                    ("progress_indicator", "Staff report that technology systems are reliable and easy to use"),
                    ("progress_indicator", "Data is accessible for decision-making at all levels"),
                    ("progress_indicator", "Technology downtime and support issues are minimal"),
                ]
            },
            {
                "code": "8B",
                "name": "Physical Environment",
                "description": "The school's physical environment is safe, well-maintained, and supports learning.",
                "evidence_guidance": "Facility condition assessment, safety audits, maintenance logs, classroom setup observations",
                "criteria": [
                    ("core_action", "A facilities maintenance and improvement plan is in place and funded"),
                    ("core_action", "Safety systems and protocols are documented and regularly tested"),
                    ("core_action", "Learning spaces are intentionally designed and maintained"),
                    ("progress_indicator", "Students and staff report feeling safe in the physical environment"),
                    ("progress_indicator", "Facility condition supports effective teaching and learning"),
                    ("progress_indicator", "Safety incidents are rare and well-managed"),
                ]
            },
            {
                "code": "8C",
                "name": "Daily Building Logistics",
                "description": "Day-to-day operations run smoothly and maximize instructional time.",
                "evidence_guidance": "Daily schedules, arrival/dismissal procedures, lunch/recess logistics, transition routines",
                "criteria": [
                    ("core_action", "Daily operational routines are documented and consistently executed"),
                    ("core_action", "Transitions, meals, and non-instructional time are managed efficiently"),
                    ("core_action", "Operational systems maximize instructional minutes"),
                    ("progress_indicator", "Transitions and logistics run smoothly with minimal disruption"),
                    ("progress_indicator", "Instructional time loss due to operational issues is minimal"),
                    ("progress_indicator", "Staff and students experience operations as orderly and predictable"),
                ]
            },
            {
                "code": "8D",
                "name": "Student Recruitment and Enrollment",
                "description": "The school has an effective strategy for recruiting and enrolling students.",
                "evidence_guidance": "Enrollment data and trends, marketing materials, recruitment events, waitlist data, retention rates",
                "criteria": [
                    ("core_action", "A student recruitment and enrollment strategy is aligned with enrollment targets"),
                    ("core_action", "Outreach reaches diverse communities and underserved populations"),
                    ("core_action", "Enrollment and re-enrollment processes are efficient and family-friendly"),
                    ("progress_indicator", "Enrollment meets or exceeds budget targets"),
                    ("progress_indicator", "Student demographics reflect or exceed the diversity of the community"),
                    ("progress_indicator", "Student re-enrollment/retention rates are strong"),
                ]
            },
            {
                "code": "8E",
                "name": "Compliance",
                "description": "The school meets all legal, regulatory, and reporting requirements.",
                "evidence_guidance": "Compliance calendar, audit results, required reporting records, policy manual, HR compliance",
                "criteria": [
                    ("core_action", "A compliance calendar tracks all required reporting and filings"),
                    ("core_action", "Internal controls and procedures support consistent compliance"),
                    ("core_action", "Staff responsible for compliance have adequate training and support"),
                    ("progress_indicator", "Audit findings are clean or show steady improvement"),
                    ("progress_indicator", "Required reports are filed accurately and on time"),
                    ("progress_indicator", "No significant compliance violations in recent history"),
                ]
            },
        ]
    },
    {
        "number": 9,
        "name": "Finance",
        "color": "#059669",
        "description": "The school's financial health, management, and strategic resource allocation.",
        "components": [
            {
                "code": "9A",
                "name": "Financial Health",
                "description": "The school is in strong financial health with adequate reserves and sustainable revenue.",
                "evidence_guidance": "Audited financials, balance sheet, cash flow statements, reserve policy, revenue trends",
                "criteria": [
                    ("core_action", "The school maintains adequate financial reserves per board policy"),
                    ("core_action", "Revenue sources are diversified and sustainable"),
                    ("core_action", "Key financial health metrics are monitored regularly"),
                    ("progress_indicator", "The school has positive net assets and adequate cash reserves"),
                    ("progress_indicator", "Revenue has been stable or growing over the past 3 years"),
                    ("progress_indicator", "Financial health metrics compare favorably to benchmarks"),
                ]
            },
            {
                "code": "9B",
                "name": "Financial Management and Controls",
                "description": "The school has strong financial management practices and internal controls.",
                "evidence_guidance": "Financial policies, audit reports, internal control documentation, board financial reports",
                "criteria": [
                    ("core_action", "Comprehensive financial policies and procedures are documented and followed"),
                    ("core_action", "Internal controls include separation of duties, approval workflows, and regular reconciliation"),
                    ("core_action", "Independent audits are conducted annually with clean opinions"),
                    ("progress_indicator", "Audit findings are clean with no material weaknesses"),
                    ("progress_indicator", "Monthly financial reports are produced and reviewed by leadership and board"),
                    ("progress_indicator", "Staff responsible for finances have adequate qualifications and training"),
                ]
            },
            {
                "code": "9C",
                "name": "Financial Planning",
                "description": "The school engages in rigorous financial planning that aligns resources with strategic priorities.",
                "evidence_guidance": "Multi-year budget projections, budget-to-actual reports, resource allocation analysis, staffing model",
                "criteria": [
                    ("core_action", "Multi-year financial projections are developed and maintained"),
                    ("core_action", "Annual budgets are aligned with strategic plan priorities"),
                    ("core_action", "Budget-to-actual performance is monitored monthly with variance analysis"),
                    ("progress_indicator", "Actual spending aligns closely with budget projections"),
                    ("progress_indicator", "Resource allocation decisions are clearly linked to strategic priorities"),
                    ("progress_indicator", "Financial planning accounts for enrollment, staffing, and programmatic scenarios"),
                ]
            },
        ]
    },
]

# Evidence data used by seed and generate_fixtures script
# Each entry: (filename, evidence_type, uploader, summary, key_findings, mapped_component_codes)
EVIDENCE_DATA = [
    ("School_Improvement_Plan_Goals_Tracker_2024-2025.csv", EvidenceType.SPREADSHEET, "Lead Consultant",
     "School improvement plan tracking 10 strategic goals aligned to SQF dimensions with baseline metrics, targets, mid-year actuals, status indicators, key strategies, and responsible leads.",
     ["10 strategic goals mapped to SQF dimensions with measurable targets",
      "Reading proficiency goal: 55% target vs 52% mid-year actual (on track)",
      "Math proficiency goal: 45% target vs 39% mid-year actual (behind)",
      "Teacher retention target of 87% with mid-year tracking at 84%",
      "Family engagement satisfaction target of 80% currently at 78%",
      "4 goals on track, 3 in progress, 2 behind, 1 at risk"],
     ["1A", "1B", "1C", "5A", "5D"]),
    ("Professional_Development_Log_2024-2025.csv", EvidenceType.SPREADSHEET, "Data Steward",
     "Complete log of 27 professional development sessions from August 2024 to March 2025, covering topics from curriculum alignment to culturally responsive teaching, trauma-informed practices, and data-driven instruction.",
     ["27 PD sessions conducted across the school year",
      "Topics include differentiation, data-driven instruction, culturally responsive teaching, and trauma-informed practices",
      "Mix of whole-staff, grade-band, and department-specific sessions",
      "External facilitators used for specialized topics like culturally responsive teaching",
      "Average session length of 2-3 hours with both full-day and after-school formats"],
     ["4A", "4D", "2C"]),
    ("Curriculum_Scope_and_Sequence_ELA_K-8.md", EvidenceType.DOCUMENT, "Lead Consultant",
     "Complete K-8 ELA curriculum scope and sequence showing adopted programs (EL Education K-5, StudySync 6-8), unit structure with quarterly organization, standards mapping, and assessment integration.",
     ["EL Education adopted for K-5 ELA, StudySync for grades 6-8",
      "Curriculum organized into quarterly units with clear scope and sequence",
      "Standards explicitly mapped to each unit",
      "Writing instruction integrated across all grade levels",
      "Supplemental materials include Fundations for phonics (K-2) and Vocabulary Workshop for middle school"],
     ["2A", "2B"]),
    ("Student_Behavior_and_Discipline_Data_2024-2025.csv", EvidenceType.SPREADSHEET, "Data Steward",
     "Incident-level discipline data tracking 29 behavioral incidents through February 2025, including incident types, responses, use of restorative practices, demographic information, and outcomes.",
     ["29 behavioral incidents recorded through February 2025",
      "Restorative practices used in majority of incidents",
      "Disrespect and disruption are most common incident types",
      "Middle school grades (6-8) account for disproportionate share of incidents",
      "Out-of-school suspensions limited to 3 cases, indicating restorative approach",
      "Some racial disproportionality evident in referral patterns"],
     ["3A", "3E"]),
    ("SEL_Survey_Results_Student_Panorama_Winter_2025.csv", EvidenceType.SPREADSHEET, "School Leader",
     "School-wide Panorama SEL survey results by grade showing 10 constructs including belonging, safety, teacher-student relationships, and engagement, with national percentile rankings and mid-year trend data.",
     ["Sense of belonging at 72nd national percentile overall",
      "School safety perception at 81st percentile",
      "Teacher-student relationships rated highly at 78th percentile",
      "Self-management scores lowest at 45th percentile",
      "Growth mindset improved 8 points from fall to winter",
      "Middle school belonging scores lower than elementary (58th vs 82nd percentile)"],
     ["3A", "3B", "3C"]),
    ("Community_Partnership_Agreements_Summary.md", EvidenceType.DOCUMENT, "Lead Consultant",
     "Summary of 14 active community partnerships including University of Minnesota, healthcare providers, arts organizations, and social service agencies, with details on scope, impact metrics, and partnership duration.",
     ["14 active community partnerships documented",
      "University of Minnesota provides tutoring and student teacher placements",
      "YMCA operates after-school program serving 95 students",
      "Healthcare partnerships provide vision/dental screenings for all students",
      "Arts partnerships include Minnesota Orchestra and local theater company",
      "Several partnerships exceed 3 years showing sustained commitment"],
     ["6A", "6B"]),
    ("Fundraising_and_Development_Report_2024-2025.md", EvidenceType.DOCUMENT, "Data Steward",
     "Annual fundraising and development report showing $142.8K raised YTD against $195K goal (73% to target), including annual gala results, grant portfolio, corporate matching programs, and donor retention analysis.",
     ["$142.8K raised year-to-date against $195K annual goal",
      "Annual gala generated $52K (largest single event)",
      "Grant portfolio includes 6 active grants totaling $87K",
      "Corporate matching program growing with 12 participating employers",
      "Donor retention rate of 68% (below 75% nonprofit benchmark)",
      "Revenue diversification remains a challenge with heavy reliance on per-pupil funding"],
     ["9A", "9B", "9C"]),
    ("Student_Attendance_Data_2024-2025.csv", EvidenceType.SPREADSHEET, "Data Steward",
     "Monthly attendance data by grade (K-8) from September to December 2024, tracking daily attendance rates, chronic absence percentages, and seasonal variation patterns.",
     ["School-wide average daily attendance of 94.2%",
      "Chronic absenteeism rate of 12.8% (above 10% state benchmark)",
      "Kindergarten and 6th grade have highest chronic absence rates",
      "Attendance dips notably in November-December across all grades",
      "K-2 attendance averages 95.1% vs 6-8 at 92.8%",
      "Pattern suggests transition years (K, 6) need targeted attendance interventions"],
     ["3D", "2D"]),
    ("Staff_Satisfaction_Survey_Results_2025.csv", EvidenceType.SPREADSHEET, "School Leader",
     "Staff satisfaction survey with 29 respondents covering leadership, professional development, collaboration, work-life balance, compensation, school culture, communication, and resource adequacy.",
     ["29 out of 32 staff responded (91% response rate)",
      "School culture rated highest at average 4.2/5.0",
      "Leadership satisfaction at 3.8/5.0",
      "Professional development satisfaction at 3.5/5.0 with notable variation",
      "Compensation rated lowest at 2.9/5.0",
      "Work-life balance concerns evident at 3.2/5.0",
      "Collaboration rated 4.0/5.0 indicating strong team culture"],
     ["4A", "4B", "4C"]),
    ("Teacher_Evaluation_Summary_2024-2025.csv", EvidenceType.SPREADSHEET, "Lead Consultant",
     "Formal teacher evaluation data for 21 staff members using Danielson Framework, with ratings across 4 domains, observation dates, identified growth areas, and professional development recommendations.",
     ["21 teachers evaluated using Danielson Framework rubric",
      "Domain 1 (Planning) average: 2.9/4.0",
      "Domain 2 (Classroom Environment) average: 3.2/4.0 (strongest)",
      "Domain 3 (Instruction) average: 2.7/4.0",
      "Domain 4 (Professional Responsibilities) average: 3.0/4.0",
      "Differentiation and questioning identified as most common growth areas",
      "3 teachers on improvement plans"],
     ["4A", "4C", "2C"]),
    ("Parent_Teacher_Conference_Attendance_Fall_2024.csv", EvidenceType.SPREADSHEET, "School Leader",
     "Fall 2024 parent-teacher conference data by teacher showing attendance rates, interpreter usage, virtual vs in-person participation, and family engagement notes across all grade levels.",
     ["Overall conference attendance rate of 83%",
      "Attendance ranges from 71% to 96% across classrooms",
      "Interpreter services used in 18% of conferences",
      "Virtual option utilized by 22% of families",
      "K-2 attendance higher (89%) than middle school (76%)",
      "Teachers note language barrier as primary obstacle for non-attending families"],
     ["6A", "3B"]),
    ("Enrollment_Trends_and_Projections_2019-2027.csv", EvidenceType.SPREADSHEET, "Data Steward",
     "Historical enrollment data from 2019 to 2025 with projections through 2027, showing growth from 268 to 420 students with demographic breakdowns including FRL, ELL, special education, and students of color percentages.",
     ["Enrollment grew from 268 (2019) to 420 (2025) — 57% increase over 6 years",
      "Free/reduced lunch percentage stable at approximately 72%",
      "ELL population growing from 18% to 23%",
      "Special education population at 13.8% (above state average)",
      "Declining 6th grade enrollment trend noted in recent years",
      "Projections show enrollment plateau around 440 by 2027"],
     ["1C", "9C"]),
    ("Technology_Plan_and_Inventory_2024-2026.md", EvidenceType.DOCUMENT, "Analyst",
     "Three-year technology strategic plan with vision, guiding principles, current device inventory (Chromebooks, iPads, interactive displays), infrastructure assessment, and refresh cycle plans aligned to school values.",
     ["1:1 Chromebook program for grades 3-8, shared iPad carts for K-2",
      "120 student Chromebooks with 18% approaching end-of-life",
      "Interactive displays in 65% of classrooms",
      "WiFi infrastructure rated adequate but needs upgrade for growing enrollment",
      "Technology budget of $45K annually (below recommended per-pupil benchmarks)",
      "Digital citizenship curriculum integrated into advisory periods"],
     ["8A", "8B", "9A"]),
    ("Safety_and_Emergency_Procedures_Manual.txt", EvidenceType.DOCUMENT, "School Leader",
     "Comprehensive emergency procedures manual covering lockdown, fire, severe weather, medical emergency, bomb threat, and active threat protocols with assigned staff roles and communication procedures.",
     ["Protocols documented for 6 emergency types",
      "Staff roles clearly assigned for each emergency scenario",
      "Monthly fire drills and quarterly lockdown drills mandated",
      "Communication plan includes parent notification procedures",
      "Manual last updated August 2024",
      "Reunification procedures included for off-site evacuations"],
     ["3D", "3E"]),
    ("Communication_Plan_2024-2025.md", EvidenceType.DOCUMENT, "Lead Consultant",
     "Strategic communications plan describing channels (ParentSquare, newsletters, conferences), stakeholder segments, language accessibility provisions, communication frequency, and message framing strategies.",
     ["ParentSquare adopted as primary digital communication platform",
      "Weekly newsletter distributed in English and Spanish",
      "Communication plan identifies 5 key stakeholder groups",
      "Social media strategy includes Facebook and Instagram with weekly posts",
      "Translation services available for 4 languages beyond English and Spanish",
      "Communication satisfaction data referenced showing 64% satisfaction rate"],
     ["6A", "6B", "5C"]),
    ("After_School_Program_Report_2024-2025.md", EvidenceType.DOCUMENT, "Analyst",
     "YMCA partnership after-school program report showing 95 students served (22.6% of enrollment), with academic support, enrichment activities, attendance data, and fee waiver information.",
     ["95 students enrolled (22.6% of school enrollment)",
      "YMCA operates program with 8 staff members",
      "Academic support component includes homework help and tutoring",
      "Enrichment includes STEM, arts, and physical activity",
      "61% of participants receive fee waivers",
      "Program attendance averages 82% among enrolled students"],
     ["6B", "3C", "2E"]),
    ("ELL_Program_Overview_and_Data_2024-2025.md", EvidenceType.DOCUMENT, "Lead Consultant",
     "English Language Learner program overview serving 97 students (23.1% of enrollment) across 7 home languages, with co-teaching and pull-out service delivery models, ACCESS benchmark data, and reclassification rates.",
     ["97 ELL students representing 23.1% of enrollment",
      "7 home languages represented with Spanish (68%) and Somali (18%) most common",
      "Co-teaching model used in grades K-5, pull-out support for grades 6-8",
      "ACCESS proficiency benchmark met by 34% of ELL students",
      "Reclassification rate of 12% annually",
      "2 certified ESL teachers plus 1 bilingual paraprofessional"],
     ["2F", "2E", "3B"]),
    ("Title_I_and_Federal_Funding_Compliance_Report.txt", EvidenceType.DOCUMENT, "Data Steward",
     "Federal funding compliance report showing $148.5K Title I allocation with detailed expenditure tracking across interventions, staffing supplements, professional development, and parent engagement activities.",
     ["Title I allocation of $148.5K for 2024-25",
      "72% of students qualify for free/reduced lunch (schoolwide program)",
      "Funds distributed: 45% interventions, 30% staffing, 15% PD, 10% parent engagement",
      "Supplement-not-supplant requirements documented and met",
      "Parent engagement set-aside of $14.8K (10% of allocation)",
      "Compliance review passed with no findings in 2024"],
     ["9A", "9B"]),
    ("Wellness_Committee_Meeting_Minutes_Nov_2024.txt", EvidenceType.DOCUMENT, "School Leader",
     "Wellness committee meeting minutes from November 2024 covering wellness policy review, physical activity minutes tracking, nutrition program updates, mental health resources, and SEL curriculum integration.",
     ["Wellness committee includes 8 members across staff, parents, and community",
      "Physical activity minutes exceed state minimum by 15%",
      "School meal program participation at 78%",
      "Mental health counselor added half-time position this year",
      "SEL curriculum (Second Step) implemented K-8",
      "Committee identified need for more recess time in middle school grades"],
     ["3C", "3D"]),
    ("Annual_School_Calendar_and_Key_Dates_2024-2025.csv", EvidenceType.SPREADSHEET, "Analyst",
     "Master school calendar showing all significant dates including PD days, parent-teacher conferences, board meetings, community events, fundraisers, emergency drills, and state testing windows for the 2024-25 school year.",
     ["180 instructional days scheduled (meets state minimum)",
      "12 professional development days built into calendar",
      "4 parent-teacher conference windows scheduled",
      "Board meetings monthly on third Thursday",
      "State testing windows clearly marked for spring",
      "8 community/family events distributed across the school year"],
     ["1C", "5B"]),
    ("Staff_Meeting_PD_Attendance_Log_2024-2025.csv", EvidenceType.SPREADSHEET, "Data Steward",
     "Attendance tracking for 30 staff members across 20 professional development sessions throughout the year, showing individual attendance rates ranging from 80% to 100% and session-level participation.",
     ["30 staff members tracked across 20 PD sessions",
      "School-wide average PD attendance rate of 92%",
      "5 staff members have 100% attendance",
      "Lowest individual attendance rate is 80% (4 absences)",
      "After-school sessions have slightly lower attendance than full-day PD",
      "No pattern of specific departments having lower attendance"],
     ["4D", "5B"]),
    ("Special_Education_Compliance_Report_2024-2025.md", EvidenceType.DOCUMENT, "Lead Consultant",
     "Special education compliance report showing 58 students with IEPs (13.8% of enrollment), service delivery models, staffing levels, compliance metrics, evaluation timelines, and areas for improvement.",
     ["58 students with IEPs (13.8% of enrollment, above state average of 14.2%)",
      "Compliance rate of 96% for IEP meeting timelines",
      "3 special education teachers plus 4 paraprofessionals",
      "Inclusion rate of 72% (students in general education 80%+ of day)",
      "Evaluation completion within 60-day timeline at 94%",
      "Parent participation in IEP meetings at 88%",
      "Identified need for more co-teaching training"],
     ["2F", "2E"]),
    ("Grade_Level_Meeting_Notes_5th_Grade_Jan_2025.txt", EvidenceType.DOCUMENT, "Analyst",
     "Fifth grade team meeting notes from January 2025 covering student data review, intervention block planning, project-based learning unit coordination, and differentiation strategies discussion.",
     ["Data review shows 5th grade reading at 58% proficiency",
      "Math proficiency at 41% with specific skills gaps identified",
      "Intervention block schedule adjusted based on winter benchmark data",
      "PBL unit on local government planned for spring semester",
      "Team discussed differentiation strategies for 6 students below benchmark",
      "Collaborative planning time used effectively for cross-subject coordination"],
     ["2C", "2D", "4D"]),
    ("New_Teacher_Onboarding_Checklist_2024-2025.md", EvidenceType.DOCUMENT, "Lead Consultant",
     "Comprehensive new teacher onboarding program checklist covering pre-employment preparation, building orientation, curriculum and technology setup, mentor assignment, observation schedule, and ongoing support systems.",
     ["Structured onboarding spans first 90 days with clear milestones",
      "Each new teacher assigned a mentor in same or adjacent grade level",
      "Technology orientation includes LMS, assessment platforms, and communication tools",
      "3 formal observations scheduled in first semester",
      "Monthly check-ins with administration during first year",
      "Onboarding feedback survey given at 30, 60, and 90 days"],
     ["4A", "4B"]),
    ("Board_Governance_Self_Assessment_2024.csv", EvidenceType.SPREADSHEET, "School Leader",
     "Board self-assessment responses from 8 board members rating governance effectiveness across 10 dimensions including mission alignment, strategic oversight, financial stewardship, and community engagement.",
     ["8 board members completed self-assessment",
      "Mission alignment rated highest at 4.6/5.0",
      "Strategic planning rated 4.2/5.0",
      "Financial oversight rated 4.0/5.0",
      "Community engagement rated lowest at 3.5/5.0",
      "Board development and succession planning rated 3.6/5.0",
      "Overall governance effectiveness self-rated at 4.0/5.0"],
     ["7A", "7B", "7C"]),
]


async def seed_framework():
    """Seed the SQF framework into the database."""
    async with async_session() as db:
        existing = await db.execute(select(Dimension))
        if existing.scalars().first():
            return  # Already seeded

        for dim_data in SQF_FRAMEWORK:
            dim = Dimension(
                number=dim_data["number"],
                name=dim_data["name"],
                color=dim_data["color"],
                description=dim_data["description"],
            )
            db.add(dim)
            await db.flush()

            for comp_data in dim_data["components"]:
                comp = Component(
                    dimension_id=dim.id,
                    code=comp_data["code"],
                    name=comp_data["name"],
                    description=comp_data["description"],
                    evidence_guidance=comp_data.get("evidence_guidance"),
                )
                db.add(comp)
                await db.flush()

                for order, (ctype, text) in enumerate(comp_data.get("criteria", [])):
                    criterion = SuccessCriterion(
                        component_id=comp.id,
                        criterion_type=CriterionType.CORE_ACTION if ctype == "core_action" else CriterionType.PROGRESS_INDICATOR,
                        text=text,
                        order=order,
                    )
                    db.add(criterion)

        await db.commit()


async def seed_demo_engagement():
    """Seed a demo engagement for Lincoln Innovation Academy."""
    async with async_session() as db:
        existing = await db.execute(select(Engagement).where(Engagement.id == ENGAGEMENT_ID))
        if existing.scalar_one_or_none():
            return  # Already seeded

        # === Demo timeline ===
        now = datetime.utcnow()
        T_DAY1_UPLOADS = now - timedelta(days=3, hours=3)
        T_DAY2_UPLOADS = now - timedelta(days=2, hours=5)
        T_SCORING = now - timedelta(days=1, hours=8)
        T_RECENT = now - timedelta(hours=2)

        RECENT_EVIDENCE = {
            "Student_Behavior_and_Discipline_Data_2024-2025.csv",
            "Grade_Level_Meeting_Notes_5th_Grade_Jan_2025.txt",
            "Board_Governance_Self_Assessment_2024.csv",
        }
        DAY2_EVIDENCE = {
            "Fundraising_and_Development_Report_2024-2025.md",
            "Title_I_and_Federal_Funding_Compliance_Report.txt",
            "Special_Education_Compliance_Report_2024-2025.md",
            "Student_Attendance_Data_2024-2025.csv",
        }

        # Create school
        school = School(
            id=SCHOOL_ID,
            name="Lincoln Innovation Academy",
            school_type="Charter",
            district="Metro City Public Schools",
            state="MN",
            grade_levels="K-8",
            enrollment="420",
        )
        db.add(school)
        await db.flush()

        # Create engagement
        engagement = Engagement(
            id=ENGAGEMENT_ID,
            school_id=SCHOOL_ID,
            name="Lincoln Innovation Academy - SQF Assessment 2025-26",
            school_name="Lincoln Innovation Academy",
            school_type="Charter",
            district="Metro City Public Schools",
            state="MN",
            grade_levels="K-8",
            enrollment=420,
            stage=EngagementStage.ASSESSMENT,
            description="Comprehensive School Quality Framework assessment for Lincoln Innovation Academy, a K-8 charter school serving 420 students in the Metro City area. This assessment covers all 9 SQF dimensions to inform strategic planning and continuous improvement.",
        )
        db.add(engagement)
        await db.flush()

        # Fork SQF framework into engagement-scoped tables
        await fork_sqf_directly_to_engagement(db, ENGAGEMENT_ID)
        await db.flush()

        # Add members
        members = [
            EngagementMember(engagement_id=ENGAGEMENT_ID, name="Sarah Chen", email="sarah.chen@meridian.io", role=EngagementRole.LEAD_CONSULTANT),
            EngagementMember(engagement_id=ENGAGEMENT_ID, name="Marcus Johnson", email="marcus.j@meridian.io", role=EngagementRole.ANALYST),
            EngagementMember(engagement_id=ENGAGEMENT_ID, name="Dr. Angela Rivera", email="arivera@lincolninnovation.org", role=EngagementRole.SCHOOL_LEADER),
            EngagementMember(engagement_id=ENGAGEMENT_ID, name="Tom Nakamura", email="tnakamura@lincolninnovation.org", role=EngagementRole.DATA_STEWARD),
        ]
        for m in members:
            db.add(m)

        await db.flush()

        # Get engagement-scoped components (these are what scores/mappings reference now)
        eng_comps_result = await db.execute(
            select(EngagementComponent)
            .join(EngagementDimension)
            .where(EngagementDimension.engagement_id == ENGAGEMENT_ID)
            .order_by(EngagementComponent.code)
        )
        comps = {c.code: c for c in eng_comps_result.scalars().all()}

        # Also load engagement dimensions for dimension summaries
        eng_dims_result = await db.execute(
            select(EngagementDimension)
            .where(EngagementDimension.engagement_id == ENGAGEMENT_ID)
            .order_by(EngagementDimension.order)
        )
        eng_dims_by_name = {d.name: d for d in eng_dims_result.scalars().all()}

        # Seed evidence items from demo_uploads/seeded/
        evidence_data = EVIDENCE_DATA

        evidence_map = {}  # code -> [evidence_ids]
        file_type_map = {
            ".csv": "text/csv",
            ".md": "text/markdown",
            ".txt": "text/plain",
            ".pdf": "application/pdf",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        for fname, etype, uploader, summary, findings, comp_codes in evidence_data:
            ext_key = os.path.splitext(fname)[1].lower()
            fpath = f"demo_uploads/seeded/{fname}"
            try:
                fsize = os.path.getsize(fpath)
            except OSError:
                fsize = 0
            # Determine evidence timestamp based on demo timeline
            if fname in RECENT_EVIDENCE:
                ev_ts = T_RECENT
            elif fname in DAY2_EVIDENCE:
                ev_ts = T_DAY2_UPLOADS
            else:
                ev_ts = T_DAY1_UPLOADS
            ev = Evidence(
                engagement_id=ENGAGEMENT_ID,
                filename=fname,
                file_path=fpath,
                file_type=file_type_map.get(ext_key, "application/octet-stream"),
                file_size=fsize,
                evidence_type=etype,
                title=fname.rsplit(".", 1)[0],
                uploaded_by=uploader,
                processing_status=ProcessingStatus.COMPLETED,
                uploaded_at=ev_ts,
            )
            db.add(ev)
            await db.flush()

            ext = EvidenceExtraction(
                evidence_id=ev.id,
                summary=summary,
                key_findings=findings,
                model_used="gpt-4.1-mini",
            )
            db.add(ext)

            for code in comp_codes:
                if code in comps:
                    mapping = EvidenceMapping(
                        evidence_id=ev.id,
                        component_id=comps[code].id,
                        relevance_score=0.85,
                        rationale=f"Content directly relevant to {code} - {comps[code].name}",
                        created_at=ev_ts,
                    )
                    db.add(mapping)
                    if code not in evidence_map:
                        evidence_map[code] = []
                    evidence_map[code].append(str(ev.id))

        # Seed component scores from AI-generated fixtures (or fallback)
        fixtures = _load_fixtures()

        # Status map: confirmed (dims 1,6,9), in_review (dims 2,3,4), draft (dims 5,7,8)
        STATUS_MAP = {
            "1A": (ScoreStatus.CONFIRMED, True), "1B": (ScoreStatus.CONFIRMED, True), "1C": (ScoreStatus.CONFIRMED, True),
            "2A": (ScoreStatus.IN_REVIEW, False), "2B": (ScoreStatus.IN_REVIEW, False), "2C": (ScoreStatus.IN_REVIEW, False),
            "2D": (ScoreStatus.IN_REVIEW, False), "2E": (ScoreStatus.IN_REVIEW, False), "2F": (ScoreStatus.IN_REVIEW, False),
            "3A": (ScoreStatus.IN_REVIEW, False), "3B": (ScoreStatus.IN_REVIEW, False), "3C": (ScoreStatus.IN_REVIEW, False),
            "3D": (ScoreStatus.IN_REVIEW, False), "3E": (ScoreStatus.IN_REVIEW, False),
            "4A": (ScoreStatus.IN_REVIEW, False), "4B": (ScoreStatus.IN_REVIEW, False), "4C": (ScoreStatus.IN_REVIEW, False),
            "4D": (ScoreStatus.IN_REVIEW, False),
            "5A": (ScoreStatus.DRAFT, False), "5B": (ScoreStatus.DRAFT, False), "5C": (ScoreStatus.DRAFT, False), "5D": (ScoreStatus.DRAFT, False),
            "6A": (ScoreStatus.CONFIRMED, True), "6B": (ScoreStatus.CONFIRMED, True),
            "7A": (ScoreStatus.DRAFT, False), "7B": (ScoreStatus.DRAFT, False), "7C": (ScoreStatus.DRAFT, False),
            "8A": (ScoreStatus.DRAFT, False), "8B": (ScoreStatus.DRAFT, False),
            "9A": (ScoreStatus.CONFIRMED, True), "9B": (ScoreStatus.CONFIRMED, True), "9C": (ScoreStatus.CONFIRMED, True),
        }

        RATING_MAP = {
            "excelling": RatingLevel.EXCELLING,
            "meeting_expectations": RatingLevel.MEETING,
            "developing": RatingLevel.DEVELOPING,
            "needs_improvement": RatingLevel.NEEDS_IMPROVEMENT,
            "not_rated": RatingLevel.NOT_RATED,
        }

        if fixtures:
            for code, score_data in fixtures["component_scores"].items():
                if code not in comps or "error" in score_data:
                    continue
                status, approved = STATUS_MAP.get(code, (ScoreStatus.DRAFT, False))
                score = ComponentScore(
                    engagement_id=ENGAGEMENT_ID,
                    component_id=comps[code].id,
                    rating=RATING_MAP.get(score_data.get("rating", "not_rated"), RatingLevel.NOT_RATED),
                    status=status,
                    approved=approved,
                    strengths=score_data.get("strengths"),
                    gaps=score_data.get("gaps"),
                    contradictions=score_data.get("contradictions"),
                    missing_evidence=score_data.get("missing_evidence"),
                    ai_rationale=score_data.get("rationale", ""),
                    evidence_count=score_data.get("evidence_count", len(evidence_map.get(code, []))),
                    confidence=score_data.get("confidence", "low"),
                    suggested_actions=score_data.get("suggested_actions"),
                    model_used=score_data.get("model_used", "gpt-4.1"),
                    scored_at=T_SCORING,
                    reviewed_at=T_SCORING + timedelta(hours=4) if approved else None,
                )
                db.add(score)

        # Seed dimension summaries from fixtures (using engagement-scoped dimensions)
        if fixtures and "dimension_summaries" in fixtures:
            for dim_name, ds_data in fixtures["dimension_summaries"].items():
                if dim_name not in eng_dims_by_name or "error" in ds_data:
                    continue
                ds = DimensionSummary(
                    engagement_id=ENGAGEMENT_ID,
                    dimension_id=eng_dims_by_name[dim_name].id,
                    overall_assessment=ds_data.get("overall_assessment"),
                    patterns=ds_data.get("patterns"),
                    compounding_risks=ds_data.get("compounding_risks"),
                    top_opportunities=ds_data.get("top_opportunities"),
                    leadership_attention=ds_data.get("leadership_attention"),
                    model_used=ds_data.get("model_used", "gpt-4.1"),
                )
                db.add(ds)

        # Seed global summary from fixtures
        if fixtures and "global_summary" in fixtures and "error" not in fixtures["global_summary"]:
            gs_data = fixtures["global_summary"]
            gs = GlobalSummary(
                engagement_id=ENGAGEMENT_ID,
                executive_summary=gs_data.get("executive_summary"),
                top_strengths=gs_data.get("top_strengths"),
                critical_gaps=gs_data.get("critical_gaps"),
                strategic_priorities=gs_data.get("strategic_priorities"),
                resource_implications=gs_data.get("resource_implications"),
                recommended_next_steps=gs_data.get("recommended_next_steps"),
                model_used=gs_data.get("model_used", "gpt-4.1"),
            )
            db.add(gs)

        # Seed data requests
        data_requests = [
            ("Current Professional Development Calendar and Agendas", "Please provide the PD calendar for 2025-26 and sample agendas from recent PD sessions.", comps.get("4D"),
             RequestStatus.PENDING, RequestPriority.HIGH, "Dr. Angela Rivera", "Sarah Chen",
             "We need this to assess the coherence and quality of the professional development program. Current observation data suggests PD may be inconsistent."),
            ("Disaggregated Discipline Data 2024-25", "Please provide suspension, referral, and behavioral incident data disaggregated by race, gender, grade, and disability status.", comps.get("3E"),
             RequestStatus.SUBMITTED, RequestPriority.HIGH, "Tom Nakamura", "Marcus Johnson",
             "Required to assess equity in behavior management practices and identify any disproportionality."),
            ("Curriculum Inventory by Subject and Grade", "List of all adopted curricula by subject and grade level, including year of adoption and any supplemental materials.", comps.get("2B"),
             RequestStatus.IN_PROGRESS, RequestPriority.MEDIUM, "Dr. Angela Rivera", "Sarah Chen",
             "Needed to evaluate curriculum quality and alignment across the school."),
            ("Staff Professional Development Survey Results", "If you have conducted any surveys about PD quality or staff satisfaction with professional learning, please share.", comps.get("4D"),
             RequestStatus.PENDING, RequestPriority.MEDIUM, "Tom Nakamura", "Marcus Johnson",
             "This would complement observation and interview data for the Talent dimension assessment."),
            ("Multi-Year Financial Projections", "3-5 year financial projections including enrollment scenarios, revenue projections, and expense forecasts.", comps.get("9C"),
             RequestStatus.ACCEPTED, RequestPriority.HIGH, "Tom Nakamura", "Sarah Chen",
             "Critical for assessing long-term financial sustainability and strategic resource alignment."),
        ]

        for title, desc, comp, status, priority, assigned, created_by, rationale in data_requests:
            dr = DataRequest(
                engagement_id=ENGAGEMENT_ID,
                component_id=comp.id if comp else None,
                title=title,
                description=desc,
                rationale=rationale,
                status=status,
                priority=priority,
                assigned_to=assigned,
                created_by=created_by,
                due_date=datetime.utcnow() + timedelta(days=14),
            )
            db.add(dr)
            await db.flush()

            # Add sample comments to data requests
            if title == "Disaggregated Discipline Data 2024-25":
                comments = [
                    DataRequestComment(data_request_id=dr.id, author="Tom Nakamura", role="data_steward",
                                       content="I've pulled the discipline data from our SIS. The file includes all referrals, suspensions, and incidents for 2024-25 disaggregated as requested. Let me know if you need additional breakdowns."),
                    DataRequestComment(data_request_id=dr.id, author="Marcus Johnson", role="analyst",
                                       content="Thank you Tom. This looks comprehensive. One follow-up: can you also include the in-school suspension data? I see out-of-school suspensions but want to capture the full picture."),
                    DataRequestComment(data_request_id=dr.id, author="Tom Nakamura", role="data_steward",
                                       content="Good catch - I'll add the ISS data and re-upload by end of week."),
                ]
                for c in comments:
                    db.add(c)
            elif title == "Curriculum Inventory by Subject and Grade":
                comments = [
                    DataRequestComment(data_request_id=dr.id, author="Dr. Angela Rivera", role="data_steward",
                                       content="I've started compiling the curriculum inventory. We have most of the ELA and math materials cataloged already. Working on getting the science and social studies lists from department heads now."),
                    DataRequestComment(data_request_id=dr.id, author="Dr. Angela Rivera", role="data_steward",
                                       content="Quick update - science and social studies are done. Still waiting on the electives team for their materials list. Should have everything together by early next week."),
                ]
                for c in comments:
                    db.add(c)
            elif title == "Multi-Year Financial Projections":
                comments = [
                    DataRequestComment(data_request_id=dr.id, author="Sarah Chen", role="analyst",
                                       content="These projections look solid, Tom. The enrollment scenario modeling is exactly what we needed. I've accepted the submission - we'll incorporate this into the financial sustainability analysis."),
                    DataRequestComment(data_request_id=dr.id, author="Tom Nakamura", role="data_steward",
                                       content="Great, glad it's what you needed. Just a note - the Year 3 projections assume the current per-pupil rate holds. If you need a sensitivity analysis with different funding scenarios, let me know."),
                ]
                for c in comments:
                    db.add(c)
            elif title == "Current Professional Development Calendar and Agendas":
                comments = [
                    DataRequestComment(data_request_id=dr.id, author="Dr. Angela Rivera", role="data_steward",
                                       content="Got it - I'll pull the PD calendar from our scheduling system and gather the agendas from this year's sessions. Should be able to start on this by Thursday."),
                ]
                for c in comments:
                    db.add(c)

        # Seed action plan
        plan = ActionPlan(
            id=PLAN_ID,
            engagement_id=ENGAGEMENT_ID,
            title="Lincoln Innovation Academy - School Success Plan (Draft)",
            description="Draft action plan based on preliminary SQF assessment findings. Focuses on highest-priority improvement areas identified through evidence analysis.",
            status=PlanStatus.DRAFT,
        )
        db.add(plan)
        await db.flush()

        action_items = [
            ("Strengthen Instructional Coaching and PD System", "Implement structured coaching cycles with clear protocols, observation cadence, and differentiated PD based on teacher needs and observation data.",
             comps.get("4D"), "Dr. Angela Rivera", "1", ItemStatus.IN_PROGRESS,
             "Observation data shows average quality of 2.8/4.0 with significant gaps in differentiation (2.3) and higher-order questioning (2.4). Principal identifies PD as inconsistent."),
            ("Develop Formal Family Engagement Strategy", "Create and implement a comprehensive family engagement strategy with equity focus, including bilingual communication systems and diverse involvement opportunities.",
             comps.get("6A"), "Marcus Johnson", "2", ItemStatus.NOT_STARTED,
             "Family survey shows communication satisfaction at 64% and involvement opportunities at 58%. 11-point satisfaction gap for Spanish-speaking families."),
            ("Build Cash Reserves and Diversify Revenue", "Develop a 2-year plan to increase cash reserves from 45 to 60+ days and reduce revenue concentration risk through grant strategy and fundraising.",
             comps.get("9A"), "Tom Nakamura", "3", ItemStatus.IN_PROGRESS,
             "Cash reserves at 45 days vs 60-day best practice. 96% revenue from per-pupil funding creates concentration risk. Grant funding declining 15%."),
            ("Address Math Achievement Gap", "Evaluate current math curriculum and intervention programs, develop targeted improvement plan for math instruction with focus on EL students and students with disabilities.",
             comps.get("2A"), "Dr. Angela Rivera", "4", ItemStatus.COMPLETED,
             "Math proficiency flat at 38% over 3 years. Growth percentile at 44th. Significant gaps for EL students (math data not disaggregated in current evidence). Principal identifies math as top academic concern."),
            ("Improve Teacher Retention Equity", "Investigate and address retention gaps for STEM teachers (68%), first-year teachers (65%), and teachers of color (76% vs 88%).",
             comps.get("4B"), "Dr. Angela Rivera", "5", ItemStatus.NOT_STARTED,
             "Despite overall improvement (72% to 84%), significant retention gaps persist by subject area, experience level, and race/ethnicity."),
        ]

        for title, desc, comp, owner, priority, status, rationale in action_items:
            item = ActionItem(
                action_plan_id=PLAN_ID,
                component_id=comp.id if comp else None,
                title=title,
                description=desc,
                rationale=rationale,
                owner=owner,
                status=status,
                priority_order=priority,
                target_date=datetime.utcnow() + timedelta(days=180),
            )
            db.add(item)

        # Seed message threads
        general_thread = MessageThread(
            engagement_id=ENGAGEMENT_ID,
            thread_type=ThreadType.GENERAL,
            title="General Discussion",
        )
        db.add(general_thread)
        await db.flush()

        general_messages = [
            Message(thread_id=general_thread.id, author="Sarah Chen", role="consultant",
                    content="Welcome to the Meridian platform! We've set up your Lincoln Innovation Academy assessment workspace. Dr. Rivera and Tom, you should now have access to upload documents and respond to data requests. Please let us know if you have any questions."),
            Message(thread_id=general_thread.id, author="Dr. Angela Rivera", role="school_leader",
                    content="Thank you Sarah! This is much more organized than our previous process. I've asked Tom to start gathering the documents on your request list. I also want to flag that we just received our fall MAP data - should I upload that as well?"),
            Message(thread_id=general_thread.id, author="Sarah Chen", role="consultant",
                    content="Absolutely - MAP data would be very valuable for the Academic Program dimension, especially for components 2D (Data and Assessment) and 2E (Intervention and Enrichment). Please upload when ready!"),
            Message(thread_id=general_thread.id, author="Marcus Johnson", role="consultant",
                    content="Hi team - I've completed initial analysis of the achievement data and budget documents. Some early patterns emerging around financial sustainability and math achievement that we should discuss in our next check-in. I'll have preliminary findings to share by Friday."),
            Message(thread_id=general_thread.id, author="Tom Nakamura", role="school_admin",
                    content="Working on pulling the discipline data and PD calendar. The discipline data should be ready by tomorrow. The PD calendar may take a bit longer as our PD coordinator is compiling it."),
            Message(thread_id=general_thread.id, author="Sarah Chen", role="consultant",
                    content="Quick update: we've completed the initial diagnostic assessment across all 32 components with mapped evidence. Dimensions 1, 6, and 9 are confirmed. The Academic Program and Talent dimensions are in review — some interesting patterns around instructional quality and retention equity that I want to discuss with the full team."),
            Message(thread_id=general_thread.id, author="Marcus Johnson", role="consultant",
                    content="I've been digging into the dimension syntheses. The Finance dimension is solid but the revenue concentration risk (96% per-pupil funding) keeps showing up across multiple components. Worth flagging for the action plan. Also, the Student Culture dimension is stronger than I expected — the SEL data and restorative practices approach are real strengths."),
        ]
        for m in general_messages:
            db.add(m)

        # Document Review channel
        doc_review_thread = MessageThread(
            engagement_id=ENGAGEMENT_ID,
            thread_type=ThreadType.GENERAL,
            title="Document Review",
        )
        db.add(doc_review_thread)
        await db.flush()

        doc_review_messages = [
            Message(thread_id=doc_review_thread.id, author="Marcus Johnson", role="consultant",
                    content="I've started reviewing the uploaded evidence. The strategic plan document is solid - clear goals and measurable outcomes. However, the budget spreadsheet seems to be missing the personnel line items. @Tom can you check on that?",
                    mentions=["Tom Nakamura"]),
            Message(thread_id=doc_review_thread.id, author="Tom Nakamura", role="school_admin",
                    content="Good catch - I think the version I uploaded was the summary view. Let me re-export with full detail including personnel costs and benefits."),
            Message(thread_id=doc_review_thread.id, author="Sarah Chen", role="consultant",
                    content="Also noting that the PD agendas we received only cover Q1. @Dr. Angela Rivera, do you have agendas from Q2-Q3 as well? Those would help us see if there's been progression in the PD focus areas.",
                    mentions=["Dr. Angela Rivera"]),
            Message(thread_id=doc_review_thread.id, author="Dr. Angela Rivera", role="school_leader",
                    content="Yes, I'll ask our PD coordinator to compile the remaining agendas. We shifted our PD focus mid-year so the Q2-Q3 sessions look quite different from Q1 - which is actually a good thing."),
        ]
        for m in doc_review_messages:
            db.add(m)

        # Leadership Team Prep channel
        leadership_thread = MessageThread(
            engagement_id=ENGAGEMENT_ID,
            thread_type=ThreadType.GENERAL,
            title="Leadership Team Prep",
        )
        db.add(leadership_thread)
        await db.flush()

        leadership_messages = [
            Message(thread_id=leadership_thread.id, author="Sarah Chen", role="consultant",
                    content="Wanted to start a thread about preparing for the on-site visit. We're tentatively looking at the week of April 14th. @Dr. Angela Rivera, does that work for your leadership team's schedule?",
                    mentions=["Dr. Angela Rivera"]),
            Message(thread_id=leadership_thread.id, author="Dr. Angela Rivera", role="school_leader",
                    content="April 14th week should work. I'll confirm with our assistant principals and instructional coaches. Should we plan for a full day or multiple half-days?"),
            Message(thread_id=leadership_thread.id, author="Sarah Chen", role="consultant",
                    content="I'd recommend two full days if possible. Day 1 for classroom observations and teacher focus groups. Day 2 for leadership interviews, document review, and a preliminary debrief. @Marcus can you draft the observation protocol?",
                    mentions=["Marcus Johnson"]),
            Message(thread_id=leadership_thread.id, author="Marcus Johnson", role="consultant",
                    content="Will do. I'll base it on the SQF instructional quality indicators from Dimension 2. Should have a draft ready by next Monday for team review."),
            Message(thread_id=leadership_thread.id, author="Tom Nakamura", role="school_admin",
                    content="I'll coordinate logistics on our end - visitor badges, room reservations for interviews, and making sure the master schedule is updated so you can plan observations efficiently."),
        ]
        for m in leadership_messages:
            db.add(m)

        # Seed activity log entries
        activity_entries = [
            # === Day 1 (3 days ago) — Engagement kickoff and initial uploads ===
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="created", target_type="engagement", target_label="Lincoln Innovation Academy - SQF Assessment", created_at=now - timedelta(days=3, hours=6)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="uploaded", target_type="evidence", target_label="School Improvement Plan Goals Tracker", detail="Extracted 6 key findings", created_at=now - timedelta(days=3, hours=5, minutes=30)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="uploaded", target_type="evidence", target_label="Curriculum Scope and Sequence ELA K-8", detail="Extracted 5 key findings", created_at=now - timedelta(days=3, hours=5, minutes=15)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Dr. Angela Rivera", action="uploaded", target_type="evidence", target_label="SEL Survey Results (Panorama Winter 2025)", detail="Extracted 6 key findings", created_at=now - timedelta(days=3, hours=4, minutes=45)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Dr. Angela Rivera", action="uploaded", target_type="evidence", target_label="Staff Satisfaction Survey Results 2025", detail="Extracted 7 key findings", created_at=now - timedelta(days=3, hours=4, minutes=20)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="uploaded", target_type="evidence", target_label="Teacher Evaluation Summary 2024-25", detail="Extracted 7 key findings", created_at=now - timedelta(days=3, hours=3, minutes=50)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="uploaded", target_type="evidence", target_label="Community Partnership Agreements Summary", detail="Extracted 6 key findings", created_at=now - timedelta(days=3, hours=3, minutes=30)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Dr. Angela Rivera", action="uploaded", target_type="evidence", target_label="Communication Plan 2024-2025", detail="Extracted 6 key findings", created_at=now - timedelta(days=3, hours=2, minutes=45)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Tom Nakamura", action="uploaded", target_type="evidence", target_label="Student Behavior and Discipline Data", detail="Submitted via data request: Disaggregated Discipline Data 2024-25", created_at=T_RECENT),

            # === Day 2 (2 days ago) — More uploads, batch scoring ===
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Tom Nakamura", action="uploaded", target_type="evidence", target_label="Fundraising and Development Report", detail="Extracted 6 key findings", created_at=now - timedelta(days=2, hours=7, minutes=10)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Tom Nakamura", action="uploaded", target_type="evidence", target_label="Title I and Federal Funding Compliance Report", detail="Extracted 6 key findings", created_at=now - timedelta(days=2, hours=6, minutes=45)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Dr. Angela Rivera", action="uploaded", target_type="evidence", target_label="Special Education Compliance Report", detail="Extracted 7 key findings", created_at=now - timedelta(days=2, hours=6, minutes=15)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Tom Nakamura", action="uploaded", target_type="evidence", target_label="Student Attendance Data 2024-25", detail="Extracted 6 key findings", created_at=now - timedelta(days=2, hours=5, minutes=30)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Dr. Angela Rivera", action="uploaded", target_type="evidence", target_label="Board Governance Self-Assessment 2024", detail="Board completed annual self-assessment", created_at=T_RECENT + timedelta(minutes=5)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="scored", target_type="component_score", target_label="Batch assessment: 32 components scored", detail="Assessed all components with mapped evidence", created_at=now - timedelta(days=1, hours=8)),

            # === Day 2 (1 day ago) — Dimension synthesis and global summary ===
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="1. Organizational Purpose", detail="Synthesized across 3 components", created_at=now - timedelta(days=1, hours=7)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="2. Academic Program", detail="Synthesized across 6 components", created_at=now - timedelta(days=1, hours=6, minutes=55)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="3. Student Culture", detail="Synthesized across 5 components", created_at=now - timedelta(days=1, hours=6, minutes=50)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="4. Talent", detail="Synthesized across 4 components", created_at=now - timedelta(days=1, hours=6, minutes=45)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="5. Leadership", detail="Synthesized across 4 components", created_at=now - timedelta(days=1, hours=6, minutes=40)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="6. External Engagement", detail="Synthesized across 2 components", created_at=now - timedelta(days=1, hours=6, minutes=35)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="7. Governance", detail="Synthesized across 3 components", created_at=now - timedelta(days=1, hours=6, minutes=30)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="8. Operations", detail="Synthesized across 2 components", created_at=now - timedelta(days=1, hours=6, minutes=25)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="dimension_summary", target_label="9. Finance", detail="Synthesized across 3 components", created_at=now - timedelta(days=1, hours=6, minutes=20)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Meridian", action="generated", target_type="global_summary", target_label="Executive Summary", detail="Synthesized across 9 dimensions", created_at=now - timedelta(days=1, hours=6)),

            # === Day 2 (1 day ago) — Consultant review and approvals ===
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="approved", target_type="component_score", target_label="1A: Mission, Vision, and Values", detail="Confirmed rating", created_at=now - timedelta(days=1, hours=4, minutes=30)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="approved", target_type="component_score", target_label="1B: Student Success Profile", detail="Confirmed rating", created_at=now - timedelta(days=1, hours=4, minutes=25)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="approved", target_type="component_score", target_label="1C: School/Program Model", detail="Confirmed rating", created_at=now - timedelta(days=1, hours=4, minutes=20)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="approved", target_type="component_score", target_label="6A: Caregiver Engagement", detail="Confirmed rating of Developing", created_at=now - timedelta(days=1, hours=3, minutes=45)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="approved", target_type="component_score", target_label="6B: Community Partnerships", detail="Confirmed rating of Meeting Expectations", created_at=now - timedelta(days=1, hours=3, minutes=40)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Marcus Johnson", action="approved", target_type="component_score", target_label="9A: Financial Health", detail="Confirmed rating of Developing", created_at=now - timedelta(days=1, hours=3)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Marcus Johnson", action="approved", target_type="component_score", target_label="9B: Financial Management and Controls", detail="Confirmed rating", created_at=now - timedelta(days=1, hours=2, minutes=55)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Marcus Johnson", action="approved", target_type="component_score", target_label="9C: Financial Planning", detail="Confirmed rating", created_at=now - timedelta(days=1, hours=2, minutes=50)),

            # === Day 3 (today) — Data requests, action items, messages ===
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Marcus Johnson", action="created", target_type="data_request", target_label="Disaggregated Discipline Data 2024-25", detail="Assigned to Tom Nakamura (High priority)", created_at=now - timedelta(hours=6, minutes=30)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="created", target_type="data_request", target_label="Current PD Calendar and Agendas", detail="Assigned to Dr. Angela Rivera (High priority)", created_at=now - timedelta(hours=6, minutes=10)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="created", target_type="action_item", target_label="Strengthen Instructional Coaching and PD System", detail="Priority 1 - Owner: Dr. Angela Rivera", created_at=now - timedelta(hours=5, minutes=15)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="created", target_type="action_item", target_label="Develop Formal Family Engagement Strategy", detail="Priority 2 - Owner: Marcus Johnson", created_at=now - timedelta(hours=5)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="created", target_type="message", target_label="Site visit planning and next steps", detail="Sent in Leadership Team Prep thread", created_at=now - timedelta(hours=3, minutes=45)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Marcus Johnson", action="edited", target_type="component_score", target_label="4A: Talent Philosophy", detail="Added consultant notes on retention equity concerns", created_at=now - timedelta(hours=2, minutes=20)),
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Sarah Chen", action="edited", target_type="component_score", target_label="2C: Instruction", detail="Added observation protocol context to rationale", created_at=now - timedelta(hours=1, minutes=10)),

            # === Recent evidence uploads (today) ===
            ActivityLog(engagement_id=ENGAGEMENT_ID, actor="Dr. Angela Rivera", action="uploaded", target_type="evidence", target_label="Grade Level Meeting Notes (5th Grade, Jan 2025)", detail="Extracted 6 key findings", created_at=T_RECENT + timedelta(minutes=10)),
        ]
        for a in activity_entries:
            db.add(a)

        await db.commit()
