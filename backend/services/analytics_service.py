from services.ward_service import WardService

class AnalyticsService:
    def __init__(self):
        self.data = WardService().data

    def summary(self):
        df = self.data
        return {
            "total_records": int(len(df)),
            "total_cities": int(df.city.nunique()),
            "total_wards": int(df[["city", "ward_id"]].drop_duplicates().shape[0]),
            "total_cases": int(df.dengue_cases.sum()),
            "average_cases": round(float(df.dengue_cases.mean()), 4),
            "latest_date": df.date.max().strftime("%Y-%m-%d"),
        }

    def trends(self, city=None, ward_id=None):
        df = self.data
        if city:
            df = df[df.city.str.casefold() == city.casefold()]
        if ward_id is not None:
            df = df[df.ward_id == str(ward_id)]
        grouped = df.groupby("date").dengue_cases.sum().sort_index()
        return [{"date": d.strftime("%Y-%m-%d"), "cases": int(v)}
                for d, v in grouped.items()]

    def city_summary(self):
        grouped = self.data.groupby("city").agg(
            records=("dengue_cases", "count"),
            total_cases=("dengue_cases", "sum"),
            average_cases=("dengue_cases", "mean"),
            wards=("ward_id", "nunique"),
        ).reset_index()
        return [{
            "city": str(r.city),
            "records": int(r.records),
            "total_cases": int(r.total_cases),
            "average_cases": round(float(r.average_cases), 4),
            "wards": int(r.wards),
        } for r in grouped.itertuples(index=False)]

    def ward_ranking(self, city=None):
        df = self.data
        if city:
            df = df[df.city.str.casefold() == city.casefold()]
        grouped = df.groupby(["city", "ward_id"]).agg(
            total_cases=("dengue_cases", "sum"),
            average_cases=("dengue_cases", "mean"),
            latest_week_cases=("dengue_cases", "last"),
        ).reset_index()
        grouped = grouped.sort_values("total_cases", ascending=False)
        return [{
            "city": str(r.city),
            "ward_id": str(r.ward_id),
            "total_historical_cases": int(r.total_cases),
            "average_weekly_cases": round(float(r.average_cases), 4),
            "latest_observed_week_cases": int(r.latest_week_cases),
        } for r in grouped.itertuples(index=False)]
