import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="系统设置" description="这里承接可配置化参数中心的前端入口，未来应对接 `/admin/config` 及其变更历史接口。" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader className="gap-2">
            <CardTitle>前端参数镜像</CardTitle>
            <CardDescription>用于查看影响用户前端展示的配置，如配额、赠送点数、活动价策略等。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-7">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="giftCredits">注册赠送点数</FieldLabel>
                  <FieldContent>
                    <Input id="giftCredits" defaultValue="100" />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="dailyFreeCredits">免费套餐日额度</FieldLabel>
                  <FieldContent>
                    <Input id="dailyFreeCredits" defaultValue="5" />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="defaultLocale">默认语言</FieldLabel>
                  <FieldContent>
                    <Select defaultValue="zh-CN">
                      <SelectTrigger id="defaultLocale">
                        <SelectValue placeholder="选择默认语言" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="zh-CN">简体中文</SelectItem>
                          <SelectItem value="en-US">English</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              </FieldGroup>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button">保存配置</Button>
                <Button type="button" variant="outline">查看历史版本</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-2">
            <CardTitle>治理提示</CardTitle>
            <CardDescription>任何会影响用户前端行为的数值与开关都不应硬编码。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border bg-secondary/35 p-4">参数变更应写入 ConfigChangeLog，支持版本回滚。</div>
            <div className="rounded-2xl border bg-secondary/35 p-4">后端通过 PriceRule 与配置中心决定真实扣费，前端只负责展示最新值。</div>
            <div className="rounded-2xl border bg-secondary/35 p-4">关键配置建议通过 SSE 或 WebSocket 触发缓存失效与页面刷新。</div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
