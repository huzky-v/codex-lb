import type { ComponentProps } from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createApiKey,
	createApiKeyAccountUsage7Day,
	createApiKeyTrends,
	createApiKeyUsage7Day,
} from "@/test/mocks/factories";
import { renderWithProviders } from "@/test/utils";
import { usePrivacyStore } from "@/hooks/use-privacy";

import { ApiDetail } from "./api-detail";

vi.mock("@/hooks/use-reduced-motion", () => ({
	useReducedMotion: () => true,
}));

const callbacks = {
	onEdit: vi.fn(),
	onDelete: vi.fn(),
	onRegenerate: vi.fn(),
	onToggleActive: vi.fn(),
};

afterEach(() => {
	act(() => {
		usePrivacyStore.setState({ blurred: false });
	});
	vi.clearAllMocks();
});

function renderApiDetail(overrides: Partial<ComponentProps<typeof ApiDetail>> = {}) {
	const apiKey = createApiKey({ name: "Analytics Key" });
	return renderWithProviders(
		<ApiDetail
			apiKey={apiKey}
			trends={null}
			usage7Day={null}
			accountUsage7Day={null}
			usage7DayLoading={false}
			usage7DayError={null}
			busy={false}
			{...callbacks}
			{...overrides}
		/>,
	);
}

describe("ApiDetail", () => {
	it("renders the empty state when no key is selected", () => {
		renderWithProviders(
			<ApiDetail
				apiKey={null}
				trends={null}
				usage7Day={null}
				accountUsage7Day={null}
				usage7DayLoading={false}
				usage7DayError={null}
				busy={false}
				{...callbacks}
			/>,
		);

		expect(screen.getByText("Select an API key")).toBeInTheDocument();
		expect(screen.getByText("Choose an API key from the list to view details.")).toBeInTheDocument();
	});

	it("shows trend chart controls and key details for the selected key", () => {
		renderApiDetail({
			trends: createApiKeyTrends({
				cost: [
					{ t: "2026-01-01T00:00:00Z", v: 0.12 },
					{ t: "2026-01-01T01:00:00Z", v: 0.08 },
				],
				tokens: [
					{ t: "2026-01-01T00:00:00Z", v: 1200 },
					{ t: "2026-01-01T01:00:00Z", v: 800 },
				],
			}),
		});

		expect(screen.getByRole("heading", { name: "Analytics Key" })).toBeInTheDocument();
		expect(screen.getByText("Account Cost")).toBeInTheDocument();
		expect(screen.getByText("Last 7 days by routed account.")).toBeInTheDocument();
		expect(screen.getByText("Usage Trend")).toBeInTheDocument();
		expect(screen.getByText("Last 7 days of tokens and cost.")).toBeInTheDocument();
		expect(screen.getByText("Tokens")).toBeInTheDocument();
		expect(screen.getByText("Cost")).toBeInTheDocument();
		expect(screen.getByRole("switch")).toBeInTheDocument();
		expect(screen.getByText("Key Details")).toBeInTheDocument();
	});

	it("prefers the 7 day usage payload over list summary usage", () => {
		renderApiDetail({
			apiKey: createApiKey({
				usageSummary: {
					requestCount: 1,
					totalTokens: 15,
					cachedInputTokens: 0,
					totalCostUsd: 0.01,
				},
			}),
			usage7Day: createApiKeyUsage7Day({
				totalTokens: 280_000,
				cachedInputTokens: 45_000,
				totalRequests: 350,
				totalCostUsd: 2.47,
			}),
		});

		expect(screen.getByText(/280K tok/)).toBeInTheDocument();
		expect(screen.getByText(/45K cached/)).toBeInTheDocument();
		expect(screen.getByText(/350 req/)).toBeInTheDocument();
		expect(screen.getByText(/\$2.47/)).toBeInTheDocument();
	});

	it("does not fall back to list summary usage while the 7 day query is loading", () => {
		renderApiDetail({
			apiKey: createApiKey({
				usageSummary: {
					requestCount: 1,
					totalTokens: 15,
					cachedInputTokens: 0,
					totalCostUsd: 0.01,
				},
			}),
			usage7Day: null,
			usage7DayLoading: true,
		});

		expect(screen.getByText("Loading 7-day usage...")).toBeInTheDocument();
		expect(screen.queryByText(/15 tok/)).not.toBeInTheDocument();
		expect(screen.queryByText(/1 req/)).not.toBeInTheDocument();
	});

	it("shows a usage error instead of falling back to list summary usage", () => {
		renderApiDetail({
			apiKey: createApiKey({
				usageSummary: {
					requestCount: 1,
					totalTokens: 15,
					cachedInputTokens: 0,
					totalCostUsd: 0.01,
				},
			}),
			usage7Day: null,
			usage7DayError: "boom usage",
		});

		expect(screen.getByText("boom usage")).toBeInTheDocument();
		expect(screen.getByText("7-day usage unavailable")).toBeInTheDocument();
		expect(screen.queryByText(/15 tok/)).not.toBeInTheDocument();
	});

	it("keeps the accumulated toggle interactive when trend data is present", async () => {
		const user = userEvent.setup();
		renderApiDetail({
			trends: createApiKeyTrends({
				cost: [{ t: "2026-01-01T00:00:00Z", v: 0.2 }],
				tokens: [{ t: "2026-01-01T00:00:00Z", v: 1500 }],
			}),
		});

		const toggle = screen.getByRole("switch");
		expect(toggle).not.toBeChecked();

		await user.click(toggle);
		expect(toggle).toBeChecked();
	});

	it("shows enable action for inactive keys and disable action for active keys", () => {
		const { rerender } = renderWithProviders(
			<ApiDetail
				apiKey={createApiKey({ isActive: true })}
				trends={null}
				usage7Day={null}
				accountUsage7Day={null}
				usage7DayLoading={false}
				usage7DayError={null}
				busy={false}
				{...callbacks}
			/>,
		);

		expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();

		rerender(
			<ApiDetail
				apiKey={createApiKey({ isActive: false })}
				trends={null}
				usage7Day={null}
				accountUsage7Day={null}
				usage7DayLoading={false}
				usage7DayError={null}
				busy={false}
				{...callbacks}
			/>,
		);

		expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
	});

	it("invokes toggle and delete callbacks from footer actions", async () => {
		const user = userEvent.setup();
		const apiKey = createApiKey({ isActive: true });
		const onToggleActive = vi.fn();
		const onDelete = vi.fn();

		renderApiDetail({ apiKey, onToggleActive, onDelete });

		await user.click(screen.getByRole("button", { name: "Disable" }));
		await user.click(screen.getByRole("button", { name: "Delete" }));

		expect(onToggleActive).toHaveBeenCalledWith(apiKey);
		expect(onDelete).toHaveBeenCalledWith(apiKey);
	});

	it("opens the actions menu and routes edit and regenerate actions", async () => {
		const user = userEvent.setup();
		const apiKey = createApiKey();
		const onEdit = vi.fn();
		const onRegenerate = vi.fn();

		renderApiDetail({ apiKey, onEdit, onRegenerate });

		await user.click(screen.getByRole("button", { name: "Actions" }));
		await user.click(screen.getByRole("menuitem", { name: "Edit" }));

		expect(onEdit).toHaveBeenCalledWith(apiKey);

		await user.click(screen.getByRole("button", { name: "Actions" }));
		await user.click(screen.getByRole("menuitem", { name: "Regenerate" }));

		expect(onRegenerate).toHaveBeenCalledWith(apiKey);
	});

	it("disables all mutation actions while busy", async () => {
		const user = userEvent.setup();
		renderApiDetail({ busy: true });

		expect(screen.getByRole("button", { name: "Actions" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Disable" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
		expect(screen.getByRole("switch")).toBeEnabled();

		await user.click(screen.getByRole("switch"));
		expect(screen.getByRole("switch")).toBeChecked();
	});

	it("blurs email-derived account labels in the donut legend when privacy mode is enabled", () => {
		act(() => {
			usePrivacyStore.setState({ blurred: true });
		});

		renderApiDetail({
			accountUsage7Day: createApiKeyAccountUsage7Day(),
		});

		expect(screen.getByText("alpha@example.com")).toHaveClass("privacy-blur");
	});

	it("limits the donut legend viewport to four rows", () => {
		renderApiDetail({
			accountUsage7Day: createApiKeyAccountUsage7Day({
				accounts: [
					{
						accountId: "a1",
						displayName: "one@example.com",
						isEmailDerived: true,
						requestCount: 1,
						totalCostUsd: 4,
					},
					{
						accountId: "a2",
						displayName: "two@example.com",
						isEmailDerived: true,
						requestCount: 1,
						totalCostUsd: 3,
					},
					{
						accountId: "a3",
						displayName: "three@example.com",
						isEmailDerived: true,
						requestCount: 1,
						totalCostUsd: 2,
					},
					{
						accountId: "a4",
						displayName: "four@example.com",
						isEmailDerived: true,
						requestCount: 1,
						totalCostUsd: 1,
					},
					{
						accountId: "a5",
						displayName: "Deleted Account",
						isEmailDerived: false,
						requestCount: 1,
						totalCostUsd: 0.5,
					},
				],
			}),
		});

		expect(screen.getByTestId("api-account-cost-legend-list")).toHaveStyle({
			maxHeight: "calc(4 * 1.75rem + 3 * 0rem)",
		});
	});

	it("keeps deleted and unknown account cost buckets distinct", () => {
		renderApiDetail({
			accountUsage7Day: createApiKeyAccountUsage7Day({
				accounts: [
					{
						accountId: null,
						displayName: "Unknown Account",
						isEmailDerived: false,
						requestCount: 2,
						totalCostUsd: 1.1,
					},
					{
						accountId: null,
						displayName: "Deleted Account",
						isEmailDerived: false,
						requestCount: 3,
						totalCostUsd: 0.8,
					},
				],
			}),
		});

		expect(screen.getByText("Unknown Account")).toBeInTheDocument();
		expect(screen.getByText("Deleted Account")).toBeInTheDocument();
		expect(screen.getByTestId("api-account-cost-legend-0")).toBeInTheDocument();
		expect(screen.getByTestId("api-account-cost-legend-1")).toBeInTheDocument();
	});
});
