Headline

Build a framework-native school quality workflow platform: a shared consultant-and-school workspace that uses Bellwether’s public SQF structure to accelerate evidence collection, diagnosis, and action planning, with AI that reasons within the framework, not outside it.

What we want to build

This is not a generic dashboard, a single giant chatbot, or an automated “gold star for schools” tool.

It is a workflow + ontology + evidence system for school quality engagements:

Workflow for managing requests, uploads, interviews, follow-ups, reviews, and action planning.

Ontology grounded in Bellwether’s public School Quality Framework: 9 dimensions, 43 components, and component-level success criteria concepts like Core Actions and Progress Indicators.

Evidence system where every finding, score, recommendation, and action item is traceable back to documents, data, transcripts, and other source evidence.

Human-in-the-loop consulting where AI accelerates the work, but expert consultants review and shape the final output.

The one-line product thesis

Watershed-grade traceability + TurboTax-grade guided intake + Better-grade shared workflow, all wrapped around a Bellwether-native school quality ontology and accelerated by multi-level AI orchestration.

The core product idea

The first product should be a shared engagement workspace for both consultants and schools. A consultant can launch an assessment, push data requests, receive artifacts, ask clarifying questions, review AI-generated evidence mapping, and convert findings into a draft action plan. The school can upload materials, respond in context, ask questions, and track progress through the assessment. Bellwether’s own public description of the SQF says it is used as the first phase of multiyear strategic planning and relies on artifact scans, interviews, focus groups, meetings, and observations, which is exactly the sort of workflow this platform can compress and organize.

The “can’t miss” anchors

Use Bellwether’s public SQF skeleton exactly. Do not invent your own top-level framework. Use the public 9 dimensions and 43 components as the backbone of the prototype.

Build the workflow before overbuilding the scoring model. The first source of value is faster, more organized evidence collection and synthesis, not a perfect rating algorithm. Bellwether’s public materials show the work is operationally heavy and staged: assessment, planning, implementation/monitoring.

Make two-sided collaboration part of v1. The consultant-school back-and-forth is not a nice-to-have. It is central to reducing cycle time and replacing scattered email, shared drives, and spreadsheet trackers with a framework-native workspace. This mirrors the interaction patterns that make Watershed, TurboTax, and Better useful analogies.

Treat traceability as a first-class feature. Every claim should answer: “Why are you saying that?” with linked evidence, excerpts, metrics, provenance, and confidence. Bellwether publicly frames the SQF as a structured diagnostic tool, and Watershed is a strong pattern for auditability and source-of-truth design.

Design AI as multi-level and ontology-bound. Not one giant chat thread. Use artifact-level extraction, component-level synthesis, dimension-level synthesis, and a top orchestration layer that queries the lower levels. Bellwether’s published structure naturally supports this.

Keep humans in the loop. The product should accelerate expert judgment, not pretend to replace it. Bellwether’s public process still depends on meetings, focus groups, site visits, and shared ownership of implementation.

The score is an output, not the product. The product is the evidence-backed diagnostic and planning system. Bellwether says it rates components on a four-point scale, but that rating sits inside a broader improvement process.

The initial product shape

The first prototype should probably have these modules:

Engagement Setup: create a school/district assessment, choose scope, assign users.

Data Request Manager: send structured requests tied to framework components, track status, due dates, clarifications.

Evidence Repository: store documents, transcripts, spreadsheets, notes, and source metadata.

Framework Mapper: connect evidence to SQF dimensions/components, with confidence and citations.

Diagnostic Workspace: show strengths, gaps, contradictions, missing evidence, provisional ratings.

Action Plan Builder: convert findings into priorities, actions, owners, milestones, and monitoring.

AI Copilot Everywhere: contextual help inside every screen for retrieval, synthesis, drafting, and follow-up questions. Bellwether’s public materials support this overall diagnostic-to-plan flow, even if the exact product modules are your invention.

The AI architecture we converged on

The right AI design is agentic, multi-level, ontology-bound, and evidence-linked.

At a practical level:

Artifact-level AI summarizes each upload, extracts facts, and tags relevant components.

Component-level AI reviews only the evidence for one of the 43 components, drafts findings, gaps, follow-ups, and provisional actions.

Dimension-level AI synthesizes across related components inside one of the 9 dimensions.

Top-level orchestration AI assembles summaries, answers questions, and helps navigate the full evidence graph without reprocessing everything from scratch. This structure fits Bellwether’s public hierarchy of dimensions, components, and success criteria.

The killer feature

In-product AI help at any moment in the workflow.

Examples:

“Did we already get evidence about intervention scheduling?”

“Show me support for this rating.”

“What’s still missing before we can score this component confidently?”

“Draft a follow-up request for the principal.”

“Pull interview excerpts relevant to staff culture.”

“Turn these findings into three action-plan options.”

That feature matters because the platform becomes a persistent reasoning companion, not just a report generator. Bellwether’s public process depends on many evidence sources and iterative review, which makes this kind of contextual assistance especially valuable.

Main guardrails

Do not build a black-box school score. Bellwether’s framework is multi-dimensional and designed for reflection, planning, and improvement, not simplistic ranking.

Do not lead with “replace consultants.” Lead with “make consultants faster, more consistent, and more evidence-backed.” Bellwether’s public materials emphasize partnership, flexibility, and implementation support.

Do not assume Bellwether’s full rubric is public. The public structure is enough for a prototype, but the detailed criteria for all 43 components do not appear to be fully published. You will need prototype assumptions in some places.

Do not optimize for one giant LLM pass over everything. The information load is too large and too heterogeneous. Structure the system around bounded reasoning units. Bellwether’s public framework gives you the right decomposition.

Do not confuse evidence ingestion with decision quality. The hard problem is not uploading files. It is structuring evidence, preserving provenance, resolving contradictions, and helping people make decisions.

Do not overclaim Bellwether alignment. Be explicit about what is public Bellwether structure versus what is your prototype logic or placeholder criteria.

Tacit things that matter but we didn’t say explicitly enough

The moat is probably not “AI summarization.” The moat is the combination of workflow, ontology, evidence graph, traceability, and human review.

The initial buyer is probably the consulting team, not the school. Start as an internal accelerator, then expand into a joint workspace, then maybe later into lighter self-serve use.

The best wedge is likely “assessment acceleration,” not “continuous school operating system.” Start with the expensive front end of the engagement.

The highest-value on-site time is trust-building and strategy work. The software should reduce collection and synthesis burden so live time is spent on leadership alignment and decision-making.

Your product should feel like software for a consulting motion, not generic edtech. That is why the Watershed / TurboTax / Better analogies are so useful: they’re about operationalizing high-stakes expert workflows. These are inferences from our discussion rather than direct claims from any one source, but they fit Bellwether’s public description of how the SQF is used.

What is public enough to use now

You have enough public Bellwether material to build a credible prototype:

the 9 SQF dimensions

the 43 component names

the concept of Core Actions and Progress Indicators

Bellwether’s description of using the SQF in assessments and strategic planning

Bellwether’s public four-point rating scale from “Excelling” to “Needs Improvement”

What you likely still need to assume or mock:

full detailed criteria for most components

exact evidence requirements by component

exact weighting/scoring logic

Bellwether’s proprietary implementation details

report formatting and priority-generation logic

Flat reading list for the team

Bellwether SQF launch post — the single most important public doc; explains what the SQF is, why Bellwether created it, how it is structured, and how they use it.
https://bellwether.org/blog/reimagining-excellence-introducing-bellwethers-school-quality-framework/

SQF framework image — the cleanest public source for the 9 dimensions and 43 components.
https://bellwether.org/wp-content/uploads/2025/08/2025-08-27-BDC-SQF-2.0-Blog-0_Framework-scaled.jpg

SQF example component image — shows how one component is expressed via Core Actions and Progress Indicators; useful for designing your component-level schema.
https://bellwether.org/wp-content/uploads/2025/08/image2.png

Shared Strategies: An Examination of Bellwether’s School Cohort Program — very important for understanding Bellwether’s diagnostic-to-plan-to-monitor operating model and the labor-intensive workflow your product should accelerate.
https://bellwether.org/wp-content/uploads/2023/09/SharedStrategies_Bellwether_September2023.pdf

SchoolPerformanceFrameworks.org — useful for thinking about how performance frameworks are used for accountability, continuous improvement, and communication; good conceptual adjacent material.
https://bellwether.org/publications/schoolperformanceframeworksorg/

Intentional Alignment: Strategic Resource Management — key Bellwether thought leadership for the finance/resource-allocation side of the product.
https://bellwether.org/publications/intentional-alignment/

Beyond the Bottom Line: K-12 Fiscal Accountability — useful if you want the finance module to sound natively Bellwether-ish rather than generic budgeting software.
https://bellwether.org/publications/beyond-the-bottom-line/

Watershed homepage — not because of climate content, but because of the product pattern: traceability, source-of-truth design, and expert-mediated data workflows.
https://watershed.com/

Better homepage — useful analogy for shared requests, document collection, in-product follow-up, and replacing email-heavy workflows.
https://better.com/

TurboTax document upload/help flow — useful analogy for guided intake, adaptive evidence collection, and structured expert-ready preparation.
https://ttlc.intuit.com/turbotax-support/en-us/help-article/product-setup/upload-documents-full-service-tax-expert/L4cgjPYQI_US_en_US

The simplest closing summary for the team

We are not building an AI that judges schools. We are building a framework-native workflow platform that helps consultants and schools move through Bellwether-style school quality assessment faster, with stronger evidence coverage, clearer traceability, better collaboration, and better draft action plans. The Bellwether SQF is public enough to anchor the prototype, and the right product pattern is a shared, document-heavy, expert-guided workflow system with multi-level AI reasoning inside it.