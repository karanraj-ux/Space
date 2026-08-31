import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  generation: number;
  latency: number;
  status: 'success' | 'error';
}

interface Props {
  data: DataPoint[];
}

export const LatencyChart: React.FC<Props> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current || data.length === 0) return;

    const margin = { top: 10, right: 20, bottom: 20, left: 40 };
    const width = wrapperRef.current.clientWidth - margin.left - margin.right;
    const height = 120 - margin.top - margin.bottom;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.generation) as [number, number])
      .range([0, width]);

    // Ensure we don't start Y at some arbitrary number
    const maxLatency = d3.max(data, d => d.latency) as number;
    const y = d3.scaleLinear()
      .domain([0, maxLatency * 1.2 || 1000]) // 20% headroom
      .range([height, 0]);

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(Math.min(data.length, 5)).tickFormat(d3.format("d")))
      .attr("color", "#9ca3af")
      .attr("font-family", "monospace");

    // Y Axis
    svg.append("g")
      .call(d3.axisLeft(y).ticks(3))
      .attr("color", "#9ca3af")
      .attr("font-family", "monospace");

    // Line
    const line = d3.line<DataPoint>()
      .x(d => x(d.generation))
      .y(d => y(d.latency))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#dc2626") // red-600
      .attr("stroke-width", 2)
      .attr("d", line);

    // Dots
    svg.selectAll(".dot")
      .data(data)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.generation))
      .attr("cy", d => y(d.latency))
      .attr("r", 4)
      .attr("fill", d => d.status === 'error' ? '#fcd34d' : '#dc2626') // yellow-300 if error
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);
      
    // Area (subtle gradient)
    const area = d3.area<DataPoint>()
      .x(d => x(d.generation))
      .y0(height)
      .y1(d => y(d.latency))
      .curve(d3.curveMonotoneX);
      
    // Defs for gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "areaGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
      
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#dc2626")
      .attr("stop-opacity", 0.3);
      
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#dc2626")
      .attr("stop-opacity", 0);
      
    svg.append("path")
      .datum(data)
      .attr("fill", "url(#areaGradient)")
      .attr("d", area);

  }, [data]);

  if (data.length <= 1) {
    return (
       <div className="w-full text-center text-[10px] text-gray-400 font-mono italic p-2 border border-dashed border-gray-200">
         Insufficient generations to chart trends (need at least 2).
       </div>
    );
  }

  return (
    <div className="flex flex-col w-full" ref={wrapperRef}>
      <div className="text-[10px] text-gray-500 font-mono uppercase font-bold mb-1 pl-10">Latency (ms) over Generations</div>
      <svg ref={svgRef}></svg>
    </div>
  );
};
