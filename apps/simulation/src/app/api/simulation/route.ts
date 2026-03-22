import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/engine/singleton";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runner = getRunner();
    const state = runner.state;

    if (!state) {
      return NextResponse.json({
        status: "idle",
        tick: 0,
        speed: 1,
        totalTicks: 0,
        agentCount: 0,
        year: 0,
        day: 0,
      });
    }

    return NextResponse.json({
      status: state.status,
      tick: state.tick,
      speed: state.speed,
      totalTicks: state.totalTicks,
      agentCount: state.agents.length,
      year: Math.floor(state.tick / 365),
      day: state.tick % 365,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, speed, seed } = body as {
      action: "init" | "start" | "pause" | "resume" | "reset";
      speed?: number;
      seed?: number;
    };

    const runner = getRunner();

    switch (action) {
      case "init": {
        await runner.init(seed ?? 42);
        break;
      }
      case "start": {
        if (!runner.state) {
          return NextResponse.json(
            { error: "Simulation not initialized. Call init first." },
            { status: 400 }
          );
        }
        runner.start();
        break;
      }
      case "pause": {
        if (!runner.state) {
          return NextResponse.json(
            { error: "Simulation not initialized." },
            { status: 400 }
          );
        }
        runner.pause();
        break;
      }
      case "resume": {
        if (!runner.state) {
          return NextResponse.json(
            { error: "Simulation not initialized." },
            { status: 400 }
          );
        }
        runner.resume();
        break;
      }
      case "reset": {
        await runner.reset(seed ?? 42);
        break;
      }
      default: {
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
      }
    }

    if (speed !== undefined && runner.state) {
      runner.setSpeed(speed);
    }

    const state = runner.state;
    if (!state) {
      return NextResponse.json({
        status: "idle",
        tick: 0,
        speed: 1,
        totalTicks: 0,
        agentCount: 0,
        year: 0,
        day: 0,
      });
    }

    return NextResponse.json({
      status: state.status,
      tick: state.tick,
      speed: state.speed,
      totalTicks: state.totalTicks,
      agentCount: state.agents.length,
      year: Math.floor(state.tick / 365),
      day: state.tick % 365,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
