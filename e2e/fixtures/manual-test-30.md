# 30 Preguntas Manuales — Test Suite

## Fáciles (1–5)
1. "¿Cuál fue el tonelaje total en 2024?"
2. "Costo por tonelada en 2024"
3. "Total production 2024"
4. "Tonnage Cerro Rojo"
5. "Cost per tonne Antacota"

## Medio-Fáciles (6–10)
6. "Tonnage by mine in 2024"
7. "¿Cuál mina produjo más tonelaje?"
8. "Costo de combustible en 2024"
9. "Cost by driver — cuál fue el más caro"
10. "Monthly tonnage trend 2024"

## Medio (11–15)
11. "Evolución mensual del costo de combustible"
12. "Tonelaje mes a mes por mina"
13. "Cost per tonne Caracoles vs El Molino"
14. "¿Cuál driver tuvo mayor costo en Q2?"
15. "Ranking de minas por tonelaje"

## Medio-Difícil (16–20)
16. "Tonelaje Cerro Rojo mes por mes en Q1"
17. "Costo de insumos evolución mensual todas las minas"
18. "Cost per tonne monthly trend — which month was highest?"
19. "¿En qué mes el tonelaje de Antacota fue máximo?"
20. "Ranking de drivers por costo — Domeyko"

## Difícil (21–25)
21. "Comparar tonelaje Cerro Rojo vs Caracoles mes a mes"
22. "Evolución del costo de mano de obra por mina mensualmente"
23. "¿Cuál fue la tendencia de costo por tonelada en Q3 para El Molino?"
24. "Costo de equipos vs insumos — todas las minas, mes por mes"
25. "Tonnage and cost per tonne — Antacota — monthly breakdown"

## Muy Difícil (26–30)
26. "¿En qué mes cada mina tuvo el mayor costo de combustible, y cuál fue el total?"
27. "Ranking por tonnage, cost per tonne, y cost_by_driver (fuel) — mes por mes para cada mina"
28. "Evolución mensual: tonelaje vs costo por tonelada vs costo de equipos — Caracoles"
29. "¿Cuál driver creció más en costo de enero a diciembre? Compara Cerro Rojo y El Molino"
30. "Full breakdown: monthly tonnage, CPT, labor cost, and ranking by mine for Q4"

---

## Notas para Testing Manual

### Casos de borde críticos
- **Años fuera de rango** (2023, 2025, 2020) → debe retornar empty
- **Meses sin data** → verify fallback behavior
- **Queries ambiguas** (e.g. "cost" sin especificar driver/tonne) → verify LLM routing
- **Periodos superpuestos** (e.g. "Q2 and June") → verify parsing
- **Driver keywords sin métrica explícita** (e.g. "combustible mensual") → verify P5 correction

### Post-Parse Rules a Validar
- **P2**: "por mina" / "cada mina" / "qué mina" → groupBy:mine ✓
- **P3**: Monthly keywords con tonnage → clear spurious groupBy:mine ✓
- **P5**: "costo de combustible" sin "por tonelada" → cost_by_driver + fuel ✓
- **P6**: cost_by_driver + mineName + groupBy:mine → clear groupBy ✓
- **P7**: Driver keyword anywhere → force driverFilter ✓
- **P8**: "ranking" o "todas las minas" + driver → groupBy:mine ✓
- **I4**: Año fuera de 2024 → empty result pre-flight ✓

### Verificaciones Visuales
- Tablas: ¿headers correctos?, ¿datos en orden?, ¿grouping coherente?
- Charts: ¿tipo correcto? (line para trends, bar para rankings, none para empty)
- Insights: ¿texto relevante?, ¿números coinciden con tabla?
- Empty state: ¿aparece "No results" cuando aplica?
