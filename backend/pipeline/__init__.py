"""
CrediFlow — LangGraph Pipeline Package
========================================

Exports the compiled LangGraph pipeline and the shared state definition
so the FastAPI layer can invoke the graph with a single call.

Public API
----------
    LoanApplicationState — TypedDict defining all data flowing through the graph
    build_graph()        — constructs and returns the compiled StateGraph
    app                  — pre-built compiled graph, ready to invoke
"""

from pipeline.state import LoanApplicationState
from pipeline.graph import build_graph, app

__all__ = ["LoanApplicationState", "build_graph", "app"]
