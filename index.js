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

	static sendMessage(message) {
		return new Promise((resolve, reject) => {
			request.post({
				url: `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN || config.telegram.token}/sendMessage`,
				form: message
			}, (error, response, body) => {
				if (error) {
					reject(error);
					console.error(error);
				} else {
					resolve(JSON.parse(body));
					console.log(JSON.parse(body));
				}
			});
		});
	}
}

koaRouter.all('/', async (ctx, next) => {
	ctx.redirect('https://telegram.me/adapterbot');
});

koaRouter.get('/:token/:chat_id', async (ctx, next) => {
	if (ctx.params.token == Adapter.getToken(ctx.params.chat_id)) {
		await Adapter.sendMessage(Object.assign({ chat_id: ctx.params.chat_id }, ctx.request.query))
			.then(async response => {
				if (response.ok) {
					await ctx.render('success', { message: 'Message Sent' });
				} else {
					ctx.throw(response.error_code, response.description, response);
				}
			})
			.catch(error => {
				ctx.throw(400, 'Bad Request', error);
			});
	} else {
		ctx.throw(400, 'Bad Request');
	}
});

koaRouter.post('/:token/:chat_id', koaBody, async (ctx, next) => {
	if (ctx.params.token == Adapter.getToken(ctx.params.chat_id)) {
		await Adapter.sendMessage(Object.assign({ chat_id: ctx.params.chat_id }, ctx.request.body))
			.then(async response => {
				if (response.ok) {
					await ctx.render('success', { message: 'Message Sent' });
				} else {
					ctx.throw(response.error_code, response.description, response);
				}
			})
			.catch(error => {
				ctx.throw(400, 'Bad Request', error);
			});
	} else {
		ctx.throw(400, 'Bad Request');
	}
});

koaRouter.post('/webhook', koaBody, async (ctx, next) => {
	if (['/start', '/help', '/help@adapterbot'].includes(ctx.request.body.message.text)) {
		let text = `
		The bot is a simple way to post messages from external sources into Telegram.

		Your address for sending messages: ${Adapter.getWebHookURL(ctx.request.body.message.chat.id)}

		List of supported parameters for text messages:

		text (string, required) - text of the message you want to send;
		parse_mode (string, optional) - send Markdown or HTML, if you want Telegram apps to show bold, italic, fixed-width text or inline URLs in your bot's message;
		disable_web_page_preview (boolean, optional) - disables link previews for links in this message;
		disable_notification (boolean, optional) - sends the message silently, users will receive a notification with no sound.

		Example: ${Adapter.getWebHookURL(ctx.request.body.message.chat.id)}?text=hello`;

		await Adapter.sendMessage({
			chat_id: ctx.request.body.message.chat.id,
			text: text,
			disable_web_page_preview: true
		})
			.then(response => {
				ctx.status = 200;
			})
			.catch(error => {
				ctx.status = 400;
			});
	} else {
		ctx.status = 200;
	}
});

app.use(async (ctx, next) => {
	try {
		await next();
		if (ctx.status == 404) ctx.throw(404, 'Not Found');
	} catch (error) {
		ctx.status = error.status || 500;
		await ctx.render('error', { message: error.message });
	}
});

app.use(koaLogger);
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', { extension: 'pug' }));
app.use(koaRouter.routes());

app.listen(process.env.PORT || config.port);