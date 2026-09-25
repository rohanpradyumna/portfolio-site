---
title: "Your Agent Doesn't Need to Read Everything"
slug: "your-agent-doesnt-need-to-read-everything"
date: "2026-09-25"
tags: ["ai"]
excerpt: "Choosing which tool to use is a narrow classification problem. You shouldn't pay a large language model to solve it by rereading your entire catalog every time."
published: true
---

![Your agent doesn't need to read everything: context crowding vs. confidence-gated tool selection](/assets/posts/your-agent-doesnt-need-to-read-everything-cover.png)

## The default agent reads everything

Most agent stacks make the same quiet mistake. Before every decision, the model receives every tool schema, every MCP server description, and every scrap of context it might conceivably need.

It reads all of it, picks one tool, and moves on. Then it does the same thing on the next step, and the step after that.

This post makes a simple argument. Choosing which tool to use is a narrow classification problem, and you shouldn't pay a large language model to solve it by rereading your entire catalog. A lightweight gate in front of the agent can make that call faster and cheaper, then hand the agent only what it needs.

## Why context crowding hurts

Crowded context costs you in three ways, and only one of them shows up on the invoice.

- **Cost.** Tool definitions are re-sent on every model call, whether or not a tool gets used. Anthropic notes that a typical five-server MCP setup (GitHub, Slack, Sentry, Grafana, Splunk) can consume about 55,000 tokens in definitions before the model does any work ([source](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)).
- **Attention.** The model must find the one relevant tool among many similar ones. Anthropic's own guidance is that tool selection accuracy degrades once you exceed 30 to 50 available tools.
- **Headroom.** Every token spent on the catalog is unavailable for the conversation, retrieved documents, or reasoning. Bigger context windows push the wall back, but they don't change the economics.

Multi-agent systems multiply all three. One user request can trigger a dozen or more model decisions across an orchestrator and its specialist agents, and each decision pays the full catalog tax.

## What the industry does today

The problem is well known, and three fixes have emerged. Each helps, but each still leaves the LLM doing the deciding.

| Approach | How it works | What's left on the table |
|---|---|---|
| Per-agent tool subsets | Each specialist agent only gets the tools for its domain | Still every tool in the domain, every call |
| Tool search (deferred loading) | The model searches the catalog and loads up to 5 matching tools on demand | The model spends a turn writing the search; no confidence score |
| Code execution | The model writes code that calls tools, loading definitions as needed | The model still reasons about which tools exist |

Tool search is the closest to what this post proposes, and it's genuinely good. Anthropic reports it typically cuts definition tokens by over 85 percent, and it preserves prompt caching ([source](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool); background in [Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)).

The remaining gap is who makes the call. In every approach above, a large model decides what to load. That decision is narrow and repetitive, which makes it a poor use of an expensive generalist.

## The pattern: a confidence-gated tool selector

Put a small, fast decision model in front of the agent. It scores every tool against the current task, and its confidence decides how much the agent sees.

| Confidence | Agent receives | Why |
|---|---|---|
| High | 1 tool, full description | The answer is clear, don't dilute attention |
| Medium | Top 3 tools | A wrong single pick is unrecoverable; a shortlist lets the agent correct the gate |
| Low | Full toolset | Unusual request; fall back to today's behavior so nothing is lost |

The gate answers one question (which tool?), and the agent keeps the job it's good at: building correct arguments and reasoning about results.

The dotted path is the escape hatch. If nothing in the shortlist fits, the agent calls `request_more_tools` with a short reason, and the gate re-selects with that extra signal.

## What the gate can be

The gate doesn't need to be an LLM. It needs to rank a bounded list of options quickly and report how sure it is. Several model types fit.

| Option | What it is | Best when |
|---|---|---|
| [Jev](https://www.ai-crescent.com/blog/jev-typesafe-pricing-2026) | A structured decision model that returns a choice, score or probability instead of text | You want an off-the-shelf ranker with confidence built in |
| Laya | A lightweight decision model used as a drop-in gate | You want another hosted option to benchmark against |
| Traditional classifier | Logistic regression or gradient boosting over text embeddings | Your toolset is stable and you have labeled routing history |
| Fine-tuned BERT | A BERT-family encoder, pre-trained or fine-tuned on your own routing logs | You want the highest accuracy on your domain and can own the model |

Jev illustrates the economics. Its early-access price is $0.042 per million input tokens with free output, because it returns a typed decision rather than generating text. It launched on September 16, 2026, so treat that rate as subject to change ([source](https://www.ai-crescent.com/blog/jev-typesafe-pricing-2026)).

The self-hosted options are cheaper still at scale, and your agent logs are free training data. Every past decision where an LLM picked a tool is a labeled example for the gate.

These options also slot into existing tooling. Anthropic's tool search supports a custom search implementation that returns tool references from your own ranker, so any of these models can sit behind it ([source](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)).

## Making it work in production

The idea is simple; these five details decide whether it holds up.

- **Write two descriptions per tool.** The gate ranks using a short tool card (name plus two or three lines), which keeps even large catalogs small. The agent receives the full production description, with input formats and edge cases, for only the selected tools.
- **Gate per task, not per step.** Running the gate before every model turn adds its latency a dozen times per request. Instead, select a working set when a specialist agent starts, and keep it for the agent's whole loop.
- **Set thresholds from data.** Run the gate in shadow mode next to your current agents for two weeks. Measure how often it agrees with the LLM's choice at each confidence level, then place the tier boundaries where accuracy drops.
- **Train on outcomes, not just choices.** Past LLM tool picks are useful labels, but some were wrong. Weight examples by whether the call succeeded, and feed `request_more_tools` events back in as corrections.
- **Keep the gate swappable.** Put it behind one interface (task in, ranked tools with scores out). You can then move from a hosted model to a fine-tuned BERT, or back, without touching the agents.

One caution on caching. If your agents already cache their tool definitions well, gating saves fewer tokens than you'd expect. In that case, justify the gate on selection accuracy and headroom, and measure cost last.

## The takeaway for solution designers

Don't make the most expensive component in your system do the cheapest job in it.

LLMs are extraordinary at reasoning, writing and adapting to the unexpected. Picking a tool from a known list is none of those things; it's classification. Hand that job to a model built for it, and give the LLM a small, clean context where every token has earned its place.

That's the real shift here. Good agent architecture isn't about adding more to the context window. It's about deciding, deliberately, what gets in.

### Sources

- [Tool search tool, Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- [Advanced tool use, Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use)
- [Jev (TypeSafe AI) pricing, Crescent AI](https://www.ai-crescent.com/blog/jev-typesafe-pricing-2026)
- [Claude Haiku 4.5, Anthropic](https://www.anthropic.com/claude/haiku)
