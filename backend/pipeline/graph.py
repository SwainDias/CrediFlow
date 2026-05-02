"""
LangGraph Pipeline Definition — CrediFlow
============================================

Builds the ``StateGraph`` that orchestrates the six autonomous agents:

    intake_agent  →  verification_agent  →  (KYC gate)
                                              │
                             ┌────────────────┤
                             │  KYC failed    │  KYC passed
                             ▼                ▼
                        audit_agent      risk_agent  →  (risk gate)
                        (rejection)           │
                                   ┌──────────┤
                                   │ low risk │ borderline / high
                                   ▼          ▼
                            negotiation   human_review
                               agent          │
                                   │          ▼
                                   │    negotiation_agent
                                   │          │
                                   └────┬─────┘
                                        ▼
                                   audit_agent
                                        │
                                       END

Conditional edges
-----------------
1. **after verification_agent** — KYC pass → risk_agent;
                                   KYC fail → audit_agent (with rejection flag)

2. **after risk_agent** — high-confidence low risk → negotiation_agent (fast-track);
                           borderline / high risk  → human_review (paused)

Interrupt
---------
``interrupt_before=["human_review"]`` causes the graph to **pause**
and return the current state.  The API caller can then inject
``human_decision`` / ``human_comment`` and resume the graph.
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from pipeline.state import LoanApplicationState
from pipeline.nodes import (
    intake_agent,
    verification_agent,
    risk_agent,
    negotiation_agent,
    audit_agent,
    human_review,
)


# ---------------------------------------------------------------------------
# Routing functions (conditional edges)
# ---------------------------------------------------------------------------

def _route_after_verification(state: LoanApplicationState) -> str:
    """
    After KYC verification, decide whether to continue the pipeline
    or short-circuit to audit with a rejection.

    Returns
    -------
    str
        ``"risk_agent"`` if KYC passed, ``"audit_agent"`` otherwise.
    """
    if state.get("kyc_passed", False):
        return "risk_agent"
    return "audit_agent"


def _route_after_risk(state: LoanApplicationState) -> str:
    """
    After risk assessment, decide whether the application can be
    fast-tracked to negotiation or needs human review first.

    Thresholds
    ----------
    * ``needs_human_review`` is set by the risk_agent node when the
      risk label is "Medium Risk" or "High Risk".

    Returns
    -------
    str
        ``"negotiation_agent"`` for low-risk fast-track,
        ``"human_review"`` for borderline / high-risk cases.
    """
    if state.get("needs_human_review", False):
        return "human_review"
    return "negotiation_agent"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def _build_state_graph() -> StateGraph:
    """
    Construct the raw (uncompiled) StateGraph with all nodes and edges.

    Returns
    -------
    StateGraph
        The uncompiled graph builder — call ``.compile(...)`` on it.
    """

    graph = StateGraph(LoanApplicationState)

    # ── Register nodes ────────────────────────────────────────────────
    graph.add_node("intake_agent",        intake_agent)
    graph.add_node("verification_agent",  verification_agent)
    graph.add_node("risk_agent",          risk_agent)
    graph.add_node("negotiation_agent",   negotiation_agent)
    graph.add_node("audit_agent",         audit_agent)
    graph.add_node("human_review",        human_review)

    # ── Entry point ───────────────────────────────────────────────────
    graph.set_entry_point("intake_agent")

    # ── Fixed edges ───────────────────────────────────────────────────
    graph.add_edge("intake_agent", "verification_agent")

    # ── Conditional edge 1: KYC gate ──────────────────────────────────
    graph.add_conditional_edges(
        source="verification_agent",
        path=_route_after_verification,
        path_map={
            "risk_agent":  "risk_agent",
            "audit_agent": "audit_agent",
        },
    )

    # ── Conditional edge 2: Risk gate ─────────────────────────────────
    graph.add_conditional_edges(
        source="risk_agent",
        path=_route_after_risk,
        path_map={
            "negotiation_agent": "negotiation_agent",
            "human_review":      "human_review",
        },
    )

    # ── After human review, proceed to negotiation ────────────────────
    graph.add_edge("human_review", "negotiation_agent")

    # ── After negotiation, always go to audit ─────────────────────────
    graph.add_edge("negotiation_agent", "audit_agent")

    # ── Audit is the terminal node ────────────────────────────────────
    graph.add_edge("audit_agent", END)

    return graph


def build_graph(*, checkpointer=None, interrupt_before=None):
    """
    Construct and compile the CrediFlow LangGraph pipeline.

    Parameters
    ----------
    checkpointer : optional
        A LangGraph checkpointer (e.g. ``MemorySaver``, ``SqliteSaver``)
        for persisting graph state across requests.  Pass ``None`` for
        stateless (single-shot) usage.
    interrupt_before : list[str] | None
        Node names to pause before.  Defaults to ``["human_review"]``.

    Returns
    -------
    CompiledStateGraph
        A compiled graph ready for ``.invoke()`` / ``.ainvoke()``.
    """
    if interrupt_before is None:
        interrupt_before = ["human_review"]

    graph = _build_state_graph()

    compiled = graph.compile(
        checkpointer=checkpointer,
        interrupt_before=interrupt_before,
    )

    return compiled


# ---------------------------------------------------------------------------
# Pre-built instance (no checkpointer) — useful for testing / scripts
# ---------------------------------------------------------------------------

app = build_graph()

