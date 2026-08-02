---
name: prompt-writing
description: >
  How this project structures prompts written for an LLM — the seven-part order
  from role and stable context through to variable input data. Use when authoring
  or reviewing a prompt, system message, or prompt template that this codebase
  sends to a model, including prompts embedded in services, Edge Functions, or
  migrations.
---

# Prompt Writing

When this project builds prompts for an LLM, write them as reusable, structured
inputs. Keep stable content first and variable content last — the stable prefix is
what a provider can cache, and moving it around defeats that.

1. **Role and purpose** — define what the AI is supposed to do, including persona,
   domain, tone, and audience.
2. **Stable context** — background that usually does not change between calls:
   product context, policy, schema notes, documentation summaries.
3. **Task instructions** — state the desired outcome, not every internal step.
   Include constraints, acceptance criteria, and failure conditions.
4. **Output requirements** — specify the exact format: JSON, Markdown, XML,
   bullets, table, code block. Ask for confidence, assumptions, and concise
   justification when useful.
5. **Examples** — include when the output shape or judgment criteria are not
   obvious. Keep them short and representative.
6. **Critical reminders** — repeat only the most important rules that are easy to
   violate.
7. **Variable input data** — put changing data last. Label inputs clearly using
   Markdown headings, XML-style tags, or JSON fields.
