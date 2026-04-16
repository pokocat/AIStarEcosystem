import { PageHeader } from "@/components/admin/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function CreditAdjustPage() {
  return (
    <>
      <PageHeader eyebrow="Adjustments" title="手动补点 / 扣点" description="提交后应创建对应 LedgerEntry 流水记录并写入 AuditLog，严禁直接改余额字段。" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader className="gap-2">
            <CardTitle>调账表单</CardTitle>
            <CardDescription>表单字段遵循附录 B.3.5，聚焦目标对象、操作类型、积分科目、金额和备注原因。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-7">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="target">目标用户 / 租户</FieldLabel>
                  <FieldContent>
                    <Input id="target" placeholder="搜索目标主体，如 Nebula Studio 或 Luna Echo" />
                    <FieldDescription>输入后应展示当前余额与最近流水摘要。</FieldDescription>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="operation">操作类型</FieldLabel>
                  <FieldContent>
                    <Select defaultValue="grant">
                      <SelectTrigger id="operation">
                        <SelectValue placeholder="选择操作类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="grant">补赠</SelectItem>
                          <SelectItem value="deduct">扣除</SelectItem>
                          <SelectItem value="expire">手动过期</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="account">积分科目</FieldLabel>
                  <FieldContent>
                    <Select defaultValue="general">
                      <SelectTrigger id="account">
                        <SelectValue placeholder="选择积分科目" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="general">通用点数</SelectItem>
                          <SelectItem value="music">AI 音乐点数</SelectItem>
                          <SelectItem value="gift">赠送点数</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="amount">金额</FieldLabel>
                  <FieldContent>
                    <Input id="amount" placeholder="输入正整数" />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="reason">备注原因</FieldLabel>
                  <FieldContent>
                    <Textarea id="reason" placeholder="填写本次补点或扣点的运营原因，便于审计追溯。" />
                  </FieldContent>
                </Field>
              </FieldGroup>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button">提交调账</Button>
                <Button type="button" variant="outline">保存草稿</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Alert variant="warning">
            <AlertTitle>强约束</AlertTitle>
            <AlertDescription>不允许直接修改余额字段，所有变更都必须写入不可变账本。</AlertDescription>
          </Alert>
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>提交后预期行为</CardTitle>
              <CardDescription>这组说明可直接指导后续接入真实接口。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border bg-secondary/35 p-4">创建对应 `LedgerEntry`，标记 operator、subject 与 reason。</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">同步写入 `AuditLog`，用于风控与财务复核。</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">如目标为租户，应保留 `userId` 为空的租户级归属。</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
