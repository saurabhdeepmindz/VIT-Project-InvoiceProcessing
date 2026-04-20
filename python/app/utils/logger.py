"""logger.py — minimal structured logger for the Python AI service."""

import logging
import os
import sys


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    level_str = os.environ.get("PYTHON_LOG_LEVEL", "info").upper()
    level = getattr(logging, level_str, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    fmt = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    handler.setFormatter(logging.Formatter(fmt))

    logger.setLevel(level)
    logger.addHandler(handler)
    logger.propagate = False
    return logger
