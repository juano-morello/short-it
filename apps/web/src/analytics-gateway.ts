export type AnalyticsOverview = {
  breakdowns: {
    countries: AnalyticsBreakdown[];
    devices: AnalyticsBreakdown[];
    referrers: AnalyticsBreakdown[];
  };
  daily: AnalyticsDailyTotal[];
};

export type AnalyticsBreakdown = {
  clicks: number;
  value: string;
};

export type AnalyticsDailyTotal = {
  clicks: number;
  dailyUniqueLinkVisitors: number;
  date: string;
};

type GatewayResult =
  | { data: AnalyticsOverview; error?: undefined }
  | { data?: undefined; error: string };

export const analyticsGateway = {
  async getOverview(organizationId: string): Promise<GatewayResult> {
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/analytics`,
        {
          credentials: "same-origin",
        },
      );
      const body = (await response.json()) as AnalyticsOverview | { message?: string };
      if (!response.ok) {
        return { error: "We couldn't load analytics right now. Please try again." };
      }
      return { data: body as AnalyticsOverview };
    } catch {
      return { error: "We couldn't load analytics right now. Please try again." };
    }
  },
};
