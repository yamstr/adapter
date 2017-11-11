'use strict';

const crypto = require('crypto');
const config = require('config');
const request = require('request');
const koa = require('koa');
const koaBody = require('koa-body')();
const koaLogger = require('koa-logger')();
const koaRouter = require('koa-router')();
const koaStatic = require('koa-static');
const koaViews = require('koa-views');
const app = new koa();

class Adapter {
	static getToken(chat_id) {
		return crypto.createHash('md5').update((process.env.SALT || config.salt) + chat_id).digest('hex');
	}

	static getWebHookURL(chat_id) {
		return `https://adapter.yamstr.com/${this.getToken(chat_id)}/${chat_id}`;
	}

	static sendMessage(chat_id, text) {
		request.post({
			url: `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN || config.telegram.token}/sendMessage`,
			form: {
				chat_id: chat_id,
				text: text
			}
		}, (error, response, body) => {
			if (error) {
				console.error(error);
			} else {
				console.log(body);
			}
		});
	}
}

koaRouter.post('/webhook', koaBody, async (ctx, next) => {
	if (['/start', '/getwh', '/getwh@adapterbot'].includes(ctx.request.body.message.text)) {
		Adapter.sendMessage(ctx.request.body.message.chat.id, `WebHook URL: ${Adapter.getWebHookURL(ctx.request.body.message.chat.id)}?text=hello`);
	}

	ctx.status = 200;
});

koaRouter.all('/:token/:chat_id', koaBody, async (ctx, next) => {
	let text;

	if (ctx.method == 'GET') text = ctx.request.query.text;
	if (ctx.method == 'POST') text = ctx.request.body.text;

	if (ctx.params.token == Adapter.getToken(ctx.params.chat_id)) {
		Adapter.sendMessage(ctx.params.chat_id, text);
		ctx.status = 200;
	} else {
		ctx.status = 400;
	}
});

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (error) {
		ctx.status = error.status || 500;
		ctx.body = {
			message: error.message
		};
	}
});

app.use(koaLogger);
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', { extension: 'pug' }));
app.use(koaRouter.routes());

app.listen(process.env.PORT || config.port);