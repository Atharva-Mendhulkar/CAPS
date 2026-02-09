"""Brand Protection & Typosquatting Defense.

Handles:
1. Brand Impersonation Detection (Levenshtein + Registry)
2. Typosquatting Detection (Homoglyphs + Visual Hashing)
"""

import json
import os
import unicodedata
from typing import List, Dict, Tuple, Optional
from pathlib import Path

# Thresholds
LEVENSHTEIN_THRESHOLD = 2  # Max edits to consider a match
SIMILARITY_THRESHOLD = 0.85

class BrandProtection:
    """Detects brand impersonation and visual lookalikes."""
    
    def __init__(self, registry_path: Optional[str] = None):
        if registry_path is None:
            # Default to caps/resources/brands.json
            base_path = Path(__file__).parent.parent
            registry_path = base_path / "resources" / "brands.json"
            
        self.registry = self._load_registry(registry_path)
        
    def _load_registry(self, path: Path) -> Dict:
        """Load canonical brand registry."""
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def check_brand_impersonation(self, merchant_vpa: str) -> Tuple[bool, Optional[str]]:
        """
        Check if VPA tries to look like a known brand but isn't allowed.
        
        Args:
            merchant_vpa: The VPA to check
            
        Returns:
            (is_impersonating, detected_brand)
        """
        vpa_user_part = merchant_vpa.split('@')[0].lower()
        normalized_vpa = self._normalize_string(vpa_user_part)
        
        for brand, data in self.registry.items():
            # 1. Exact Allowlist Check
            if merchant_vpa in data["allowed_vpas"]:
                continue  # legitimate brand VPA
            
            # Check keywords
            for keyword in data["keywords"]:
                # 2. Exact keyword containment (e.g. "amazon-support")
                if keyword in normalized_vpa:
                    return True, brand
                
                # 3. Levenshtein Check (e.g. "amaz0n")
                # Only check if normalized VPA is close in length to keyword
                if abs(len(normalized_vpa) - len(keyword)) <= LEVENSHTEIN_THRESHOLD:
                    dist = self._levenshtein_distance(normalized_vpa, keyword)
                    if dist <= LEVENSHTEIN_THRESHOLD and len(keyword) > 3:
                        return True, brand
                        
        return False, None

    def _normalize_string(self, text: str) -> str:
        """
        Normalize text to prevent homoglyph attacks.
        Uses NFKC normalization and basic confusable mapping.
        """
        # 1. Unicode Normalization (NFKC)
        text = unicodedata.normalize('NFKC', text)
        
        # 2. Common Leetspeak/Homoglyph Mapping
        replacements = {
            '0': 'o',
            '1': 'l',
            '@': 'a',
            '$': 's',
            '!': 'i',
            '3': 'e'
        }
        for char, replacement in replacements.items():
            text = text.replace(char, replacement)
            
        return text.lower()

    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        """Compute Levenshtein distance between two strings."""
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
