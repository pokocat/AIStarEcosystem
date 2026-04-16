import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function LicenseBatchCreatePage() {
  return (
    <>
      <PageHeader eyebrow="Batch Create" title="创建卡密批次" description="生成批次时需明确关联产品、套餐类型、卡密类型、数量、有效期与渠道归属。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>批次创建表单</CardTitle>
          <CardDescription>提交后建议自动生成批次号，并将 `ownerTenantId` 与渠道归属一并写入。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-7">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product">关联产品</FieldLabel>
                <FieldContent>
                  <Select defaultValue="ai-singer">
                    <SelectTrigger id="product">
                      <SelectValue placeholder="选择产品" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="ai-singer">AI 歌手</SelectItem>
                        <SelectItem value="ai-artist">AI 艺人</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="plan">套餐类型</FieldLabel>
                <FieldContent>
                  <Select defaultValue="pro">
                    <SelectTrigger id="plan">
                      <SelectValue placeholder="选择套餐" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="type">卡密类型</FieldLabel>
                <FieldContent>
                  <Select defaultValue="credits">
                    <SelectTrigger id="type">
                      <SelectValue placeholder="选择卡密类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="credits">积分包</SelectItem>
                        <SelectItem value="duration">时长兑换</SelectItem>
                        <SelectItem value="seat">席位扩容</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="count">生成数量</FieldLabel>
                <FieldContent>
                  <Input id="count" placeholder="如 1000" />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="validity">有效期范围</FieldLabel>
                <FieldContent>
                  <Input id="validity" placeholder="2026-04-16 ~ 2026-06-30" />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="channel">渠道归属</FieldLabel>
                <FieldContent>
                  <Input id="channel" placeholder="如 华东直营 / 海外合作渠道" />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="remark">备注说明</FieldLabel>
                <FieldContent>
                  <Textarea id="remark" placeholder="补充投放说明、结算备注或批次用途。" />
                  <FieldDescription>建议在此记录库存同步和外部系统对账的关联备注。</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button">生成批次</Button>
              <Button type="button" variant="outline">保存模板</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
