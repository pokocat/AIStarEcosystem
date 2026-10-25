package com.aistareco.aep.billing;

import com.aistareco.aep.billing.controller.InternalGrantConversionController;
import com.aistareco.aep.billing.dto.ModelBillingDtos.TargetOption;
import com.aistareco.aep.billing.model.CreditCampaign;
import com.aistareco.aep.billing.repository.CreditCampaignRepository;
import com.aistareco.aep.billing.service.ModelBillingAdminCatalog;
import com.aistareco.aep.billing.service.ModelBillingConfigService;
import com.aistareco.aep.billing.service.ModelBillingTarget;
import com.aistareco.aep.billing.service.ModelGrantConversionService;
import com.aistareco.aep.billing.service.ModelGrantConversionService.Line;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class InternalGrantConversionControllerTest {
    final ModelGrantConversionService conversions = mock(ModelGrantConversionService.class);
    final ModelBillingConfigService config = mock(ModelBillingConfigService.class);
    final ModelBillingAdminCatalog catalog = mock(ModelBillingAdminCatalog.class);
    final CreditCampaignRepository campaigns = mock(CreditCampaignRepository.class);
    final InternalGrantConversionController controller = new InternalGrantConversionController(conversions, config, catalog, campaigns);
    final InternalGrantConversionController.RunInput input = new InternalGrantConversionController.RunInput(
            "conv-test-0001", "admin-1", "h3", "H3 赠款", 3, 1000, 30, "积分转赠款");

    static Line line(String user, long amount) {
        return new Line(user, "w-" + user, null, null, amount, 0, 0, amount + 1000, 1000, amount, amount > 0 ? "ready" : "nothing", null);
    }
    static MockHttpServletRequest local() { var r = new MockHttpServletRequest(); r.setRemoteAddr("127.0.0.1"); return r; }

    @Test void requestsThroughNginxAreRejected() {
        var proxied = local(); proxied.addHeader("X-Forwarded-For", "1.2.3.4");
        assertThatThrownBy(() -> controller.preview(new InternalGrantConversionController.PreviewInput(3, 1000), proxied))
                .isInstanceOf(BusinessException.class).extracting("code").isEqualTo("GRANT_CONVERSION_LOCAL_ONLY");
        var remote = new MockHttpServletRequest(); remote.setRemoteAddr("10.0.0.8");
        assertThatThrownBy(() -> controller.run(input, remote))
                .isInstanceOf(BusinessException.class).extracting("code").isEqualTo("GRANT_CONVERSION_LOCAL_ONLY");
        verifyNoInteractions(conversions, config);
    }

    @Test void createsCampaignOnceThenConvertsOnlyCustomersWithSomethingToConvert() {
        when(conversions.candidates(3, 1000)).thenReturn(List.of(line("a", 5000), line("b", 0), line("c", 14286)));
        when(campaigns.findAll()).thenReturn(List.of());
        var target = new ModelBillingTarget("aiavatar", "video", "h3", "minimax-h3", "default", "second");
        when(catalog.targets()).thenReturn(List.of(new TargetOption("h3", "H3", "jusuan", target)));
        var saved = new CreditCampaign(); saved.setId("camp-1"); saved.setName("H3 赠款");
        when(config.saveCampaign(eq(null), any(), eq("admin-1"))).thenReturn(saved);

        controller.run(input, local());

        var campaign = ArgumentCaptor.forClass(ModelBillingConfigService.CampaignInput.class);
        verify(config).saveCampaign(eq(null), campaign.capture(), eq("admin-1"));
        assertThat(campaign.getValue().targets()).containsExactly(target);
        assertThat(campaign.getValue().totalIssueLimit()).isEqualTo(2 * 19286);
        assertThat(campaign.getValue().perWalletIssueLimit()).isEqualTo(2 * 14286);
        var request = ArgumentCaptor.forClass(ModelGrantConversionService.Request.class);
        verify(conversions).execute(request.capture(), eq("admin-1"));
        assertThat(request.getValue().campaignId()).isEqualTo("camp-1");
        assertThat(request.getValue().userIds()).containsExactly("a", "c");

        // Retry reuses the campaign by name instead of creating a second one.
        when(campaigns.findAll()).thenReturn(List.of(saved));
        controller.run(input, local());
        verify(config, times(1)).saveCampaign(any(), any(), any());
    }
}
